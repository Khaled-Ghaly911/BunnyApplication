import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './bunny.service';
import { Gallery } from './gallery.schema';
import { GraphQLUpload, FileUpload } from 'graphql-upload-minimal';
import { InputType, Field } from '@nestjs/graphql';

@InputType()
class CreateCollectionInput {
  @Field()
  name: string;
}

@InputType()
class UploadVideoInput {
  @Field()
  galleryId: string;

  @Field()
  collectionId: string;

  @Field({ nullable: true })
  title?: string;
}

@Resolver(() => Gallery)
export class UploadResolver {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Mutation to create a new Bunny Stream Collection and return its GUID.
   */
  @Mutation(() => String, { description: 'Create a new Bunny Stream collection' })
  async createCollection(
    @Args('input') input: CreateCollectionInput,
  ): Promise<string> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Collection name must be provided');
    }
    return this.uploadService.createCollection(input.name.trim());
  }

  /**
   * Mutation to upload a video to a specific Bunny Stream Collection
   * and persist in the Gallery document.
   */
  @Mutation(() => Gallery, { description: 'Upload a video to Bunny and save metadata' })
  async uploadVideo(
    @Args('input') input: UploadVideoInput,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
  ): Promise<Gallery> {
    const { createReadStream, filename, mimetype } = await file;

    // Stream to buffer
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream();
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);

    const multerLikeFile = {
      buffer,
      originalname: filename,
      mimetype,
      size: buffer.length,
    } as Express.Multer.File;

    return this.uploadService.uploadToBunnyAndSave(
      input.galleryId,
      multerLikeFile,
      input.title ?? filename,
    );
  }
}
