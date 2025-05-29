import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './bunny.service';

describe('BunnyResolver', () => {
  let resolver: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();

    resolver = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
