import { Module } from '@nestjs/common';
import { UploadService } from './bunny.service';
import { GalleryResolver } from './bunny.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Gallery, GallerySchema } from './gallery.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gallery.name, schema: GallerySchema },  
    ])
  ],
  providers: [UploadService, GalleryResolver]
})
export class BunnyModule {}
