import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
class VideoEntry {
  @Field() videoId: string;
  @Field({ nullable: true }) playbackUrl?: string;
  @Field({ nullable: true }) thumbnailUrl?: string;
  @Field({ nullable: true }) uploadedAt?: Date;
  @Field({ nullable: true }) collectionId?: string;
}

// gallery.schema.ts
@ObjectType()
@Schema()
export class Gallery {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Prop({ required: true }) 
  @Field()
  name: string;

  @Prop({ type: [{ type: Object }], default: [] })
  @Field(() => [VideoEntry])
  videos: VideoEntry[];

  // NEW: store the Bunny collection GUID here
  @Prop({ type: String, nullable: true })
  @Field({ nullable: true })
  collectionId?: string;
}

export type GalleryDocument = Gallery & Document;
export const GallerySchema = SchemaFactory.createForClass(Gallery);

// Ensure _id is set on document creation
GallerySchema.pre('save', function(next) {
  if (!this._id) {
    this._id = new Types.ObjectId();
  }
  next();
});
