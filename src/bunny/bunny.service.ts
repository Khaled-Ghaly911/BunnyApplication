import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosInstance } from 'axios';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Gallery, GalleryDocument } from './gallery.schema';
import * as tus from 'tus-js-client';
import { createHash } from 'crypto';

@Injectable()
export class UploadService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger = new Logger(UploadService.name);
  private readonly libraryGuid: string;
  private readonly apiKey: string;

  constructor(
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
    private readonly config: ConfigService,
  ) {
    this.libraryGuid = this.config.get<string>('BUNNY_LIB_ID')!;
    this.apiKey      = this.config.get<string>('BUNNY_API_KEY')!;
    if (!this.libraryGuid || !this.apiKey) {
      throw new Error('Missing Bunny Stream credentials');
    }

    this.axiosInstance = axios.create({
      baseURL: `https://video.bunnycdn.com/library/${this.libraryGuid}`,
      headers: { AccessKey: this.apiKey },
    });
  }

  async createGallery(name: string): Promise<Gallery> {
    const gallery = new this.galleryModel({ name, _id: new Types.ObjectId() });
    return gallery.save();
  }

  async findAllGalleries(): Promise<Gallery[]> {
    return this.galleryModel.find().exec();
  }

  async uploadToBunnyAndSave(
    galleryId: string,
    file: Express.Multer.File,
    title = file.originalname,
  ): Promise<Gallery> {
    // 1. Find or create Gallery
    let gallery = await this.galleryModel.findById(galleryId).exec();
    if (!gallery) {
      gallery = new this.galleryModel({ _id: galleryId, name: title, videos: [] });
      await gallery.save();
    }

    // 2. Find or create Bunny collection
    let collectionId = gallery.collectionId;
    if (!collectionId) {
      try {
        const res = await this.axiosInstance.post<{ guid: string }>(
          '/collections',
          { name: gallery.name },
          { headers: { 'Content-Type': 'application/json' } },
        );
        collectionId = res.data.guid;
        gallery.collectionId = collectionId;
        await gallery.save();
        this.logger.log(`Created collection ${collectionId}`);
      } catch (e: any) {
        this.logger.error('Collection creation failed', e.response?.data || e.message);
        throw new InternalServerErrorException('Could not create Bunny collection');
      }
    }

    // 3. Initialize video placeholder (only to get the GUID)
    let videoGuid: string;
    try {
      const res = await this.axiosInstance.post<{ guid: string }>(
        '/videos',
        { Title: title },
        {
          params: { collectionId },
          headers: { 'Content-Type': 'application/json' },
        },
      );
      videoGuid = res.data.guid;
      this.logger.log(`Video placeholder GUID: ${videoGuid}`);
    } catch (e: any) {
      this.logger.error('Video init failed', e.response?.data || e.message);
      throw new BadRequestException('Failed to initialize video on Bunny Stream.');
    }

    // 4. Compute TUS signature
    const expire = Math.floor(Date.now() / 1000) + 3600; // 1h
    const sig    = createHash('sha256')
      .update(this.libraryGuid + this.apiKey + expire + videoGuid)
      .digest('hex');

    // 5. Perform the TUS upload
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file.buffer, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000],
        headers: {
          AuthorizationSignature: sig,
          AuthorizationExpire:    expire.toString(),
          VideoId:                videoGuid,
          LibraryId:              this.libraryGuid,
        },
        metadata: {
          filename:   file.originalname,
          filetype:   file.mimetype,
          title,
          collection: collectionId,
        },
        onError: (err) => {
          this.logger.error('TUS upload error', err);
          reject(new InternalServerErrorException('Video upload failed'));
        },
        onProgress: (uploaded, total) => {
          this.logger.log(`Uploading ${uploaded}/${total}`);
        },
        onSuccess: () => {
          this.logger.log(`TUS upload complete for ${videoGuid}`);
          resolve();
        },
      });

      upload.findPreviousUploads()
        .then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        })
        .catch(reject);
    });

    // 6. Fetch metadata & persist
    try {
      const r = await this.axiosInstance.get(`/videos/${videoGuid}`);
      const meta = r.data;
    } catch (e: any) {
      this.logger.error('Metadata fetch failed', e.response?.data || e.message);
      throw new InternalServerErrorException('Could not retrieve metadata');
    }

    const playbackUrl = `https://iframe.mediadelivery.net/play/${this.libraryGuid}/${videoGuid}`;
    const entry = {
      videoId:      videoGuid,
      playbackUrl,
      uploadedAt:   new Date(),
      collectionId,
    };

    gallery.videos.push(entry);
    await gallery.save();
    this.logger.log(`Saved video ${videoGuid} to gallery ${galleryId}`);

    return gallery;
  }
}

