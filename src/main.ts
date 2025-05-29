import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { graphqlUploadExpress } from 'graphql-upload-minimal';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable file uploads
  app.use(graphqlUploadExpress({
    maxFileSize: 10000000, // 10 MB
    maxFiles: 1
  }));

  // Enable validation

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
