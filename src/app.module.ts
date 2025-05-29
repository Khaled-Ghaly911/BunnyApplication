import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphQLUpload } from 'graphql-upload-minimal';
import { MongooseModule } from '@nestjs/mongoose';
import { Gallery, GallerySchema } from './bunny/gallery.schema';
import { DatabaseModule } from './database/database';
import { BunnyModule } from './bunny/bunny.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      resolvers: { Upload: GraphQLUpload },
      playground: true,
      buildSchemaOptions: {
        numberScalarMode: 'integer',
      },
      context: ({ req, res }) => ({ req, res }),
      csrfPrevention: false
    }),
    BunnyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}