import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { Gallery, GalleryDocument } from './gallery.schema';

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
  ) {}

  /**
   * Creates a new Collection in Bunny Stream.
   * @param name - Name for the new collection
   * @returns collection GUID
   */
  async createCollection(name: string): Promise<string> {
    if (!process.env.BUNNY_LIB_ID || !process.env.BUNNY_API_KEY) {
      throw new BadRequestException('Bunny Stream credentials are not configured.');
    }

    const url = `https://video.bunnycdn.com/library/${process.env.BUNNY_LIB_ID}/collections`;
    const headers = {
      AccessKey: process.env.BUNNY_API_KEY,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(
        url,
        { name },
        { headers }
      );

        const { guid } = response.data;

        return guid;

    } catch(err) {
        throw new Error(`Error in collection creation. Error: ${err}`)
    }

  }

  /**
   * Uploads a video file to Bunny Stream under a given collection,
   * and saves the metadata into the specified Gallery document.
   * @param galleryId - MongoDB Gallery document ID
   * @param file - Multer file object
   * @param title - Optional title for the video on Bunny
   * @param collectionId - Bunny Stream Collection GUID
   */
  async uploadToBunnyAndSave(
    galleryId: string,
    file: Express.Multer.File,
    title = file.originalname,
  ): Promise<Gallery> {
    if (!process.env.BUNNY_LIB_ID || !process.env.BUNNY_API_KEY) {
      throw new BadRequestException('Bunny Stream credentials are not configured.');
    }
    const collectionId = await this.createCollection(title.toString());
    const baseUrl = `https://video.bunnycdn.com/library/${process.env.BUNNY_LIB_ID}`;
    const headers = { AccessKey: process.env.BUNNY_API_KEY };

    // 1. Create the video placeholder with collection assignment
    const videoCreateUrl = `${baseUrl}/videos?collectionId=${collectionId}`;
    const createRes = await axios.post(
      videoCreateUrl,
      { title },
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
    const { guid, uploadUrl } = createRes.data;
    if (!guid || !uploadUrl) {
        throw new BadRequestException('Failed to initialize video upload on Bunny Stream.');
    }
    console.log(`Guid: ${guid}, uploadUrl: ${uploadUrl}`);

    // 2. Upload binary to the pre-signed URL
    await axios.put(uploadUrl, file.buffer, {
      headers: {
        'Content-Type': file.mimetype,
        'Content-Length': file.size,
      },
    });

    // 3. Retrieve metadata after processing
    const metaRes = await axios.get(
      `${baseUrl}/videos/${guid}`,
      { headers }
    );
    const { host, hostSign, thumbnailUrl, createdAt } = metaRes.data;
    const playbackUrl = `https://${host}/${guid}/manifest/video.m3u8${hostSign}`;

    // 4. Persist video metadata into MongoDB
    const entry = {
      videoId: guid,
      playbackUrl,
      thumbnailUrl,
      uploadedAt: new Date(createdAt),
      collectionId,
    };

    const updated = await this.galleryModel.findByIdAndUpdate(
      galleryId,
      { $push: { videos: entry } },
      { new: true }
    ).exec();

    if (!updated) {
      throw new BadRequestException(`Gallery with id ${galleryId} not found.`);
    }

    return updated;
  }
}
