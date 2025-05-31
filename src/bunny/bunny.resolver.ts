import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { FileUpload, GraphQLUpload } from 'graphql-upload-minimal';
import { UploadService } from './bunny.service';
import { Gallery } from './gallery.schema';
import { InputType, Field, ID } from '@nestjs/graphql';
import { Types } from 'mongoose';

@InputType()
export class UploadVideoInput {
  @Field(() => String, { description: 'MongoDB ObjectId of the Gallery to attach the video to' })
  galleryId: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional custom title for the uploaded video (defaults to filename)',
  })
  title?: string;
}

@Resolver(() => Gallery)
export class GalleryResolver {
  constructor(private readonly uploadService: UploadService) {}

  @Query(() => [Gallery], { description: 'Get all galleries' })
  async galleries(): Promise<Gallery[]> {
    return this.uploadService.findAllGalleries();
  }

  @Mutation(() => Gallery)
  async createGallery(
    @Args('name') name: string,
  ): Promise<Gallery> {
    return this.uploadService.createGallery(name);
  }

  @Mutation(() => Gallery)
  async uploadVideo(
    @Args('input') input: UploadVideoInput,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
  ): Promise<Gallery> {
    const { createReadStream, filename, mimetype } = file;
    const chunks: Buffer[] = [];
    await new Promise<void>((res, rej) => {
      createReadStream()
        .on('data', (c: Buffer) => chunks.push(c))
        .on('end', () => res())
        .on('error', (e) => rej(e));
    });
    const buffer = Buffer.concat(chunks);

    const multerFile = {
      buffer,
      originalname: filename,
      mimetype,
      size: buffer.length,
    } as Express.Multer.File;

    return this.uploadService.uploadToBunnyAndSave(
      input.galleryId.toString(),
      multerFile,
      input.title ?? filename,
    );
  }
}
