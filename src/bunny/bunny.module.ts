import { Module } from '@nestjs/common';
import { UploadService } from './bunny.service';
import { UploadResolver } from './bunny.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Gallery, GallerySchema } from './gallery.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gallery.name, schema: GallerySchema },  
    ])
  ],
  providers: [UploadService, UploadResolver]
})
export class BunnyModule {}
