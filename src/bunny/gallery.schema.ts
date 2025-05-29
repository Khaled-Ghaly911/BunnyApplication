import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Schema()
export class Gallery {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop() 
  name: string;

  @Field()
  @Prop()
  collectionId: string;
  
  @Field(() => [Video])
  @Prop([{ 
    videoId:   String,
    playbackUrl: String,
    thumbnailUrl: String,
    uploadedAt: Date
  }])
  videos: Array<{
    videoId: string;
    playbackUrl: string;
    thumbnailUrl: string;
    uploadedAt: Date;
  }>;
}

@ObjectType()
class Video {
  @Field()
  videoId: string;

  @Field()
  playbackUrl: string;

  @Field()
  thumbnailUrl: string;

  @Field()
  uploadedAt: Date;
}

export type GalleryDocument = Gallery & Document;
export const GallerySchema = SchemaFactory.createForClass(Gallery);
