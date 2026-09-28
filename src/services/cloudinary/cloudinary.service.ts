import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { CLOUDINARY } from "./cloudinary.provider.js";
import { type UploadApiResponse, v2 } from "cloudinary";
import { Readable } from "stream";

type AllowedType = 'image' | 'pdf' | 'any';

const ALLOWED_IMAGE_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
];

const ALLOWED_PDF_MIMES = ['application/pdf'];

@Injectable()
export class CloudinaryService {
    constructor(
        @Inject(CLOUDINARY)
        private readonly cloudinary: typeof v2,
    ) { }

    async uploadFile(
        file: Express.Multer.File,
        folder: string,
        allowedType: AllowedType = 'image'
    ): Promise<{ url: string, publicId: string }> {
        if (!file || !file.buffer) {
            throw new BadRequestException('File is required');
        }

        const isImage = ALLOWED_IMAGE_MIMES.includes(file.mimetype);
        const isPdf = ALLOWED_PDF_MIMES.includes(file.mimetype);

        if (allowedType === 'image' && !isImage) {
            throw new BadRequestException(
                'Only image files are allowed (jpeg, png, webp, gif, svg)',
            );
        }

        if (allowedType === 'pdf' && !isPdf) {
            throw new BadRequestException('Only PDF files are allowed');
        }

        if (allowedType === 'any' && !isImage && !isPdf) {
            throw new BadRequestException('Only image or PDF files are allowed');
        }

        // Cloudinary resource_type: 'raw' for PDFs, 'image' for images
        const resourceType = isPdf ? 'raw' : 'image';

        return new Promise((resolve, reject) => {
            const uploadStream = this.cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: resourceType,
                    use_filename: false,
                    unique_filename: true,
                },
                (error, result?: UploadApiResponse) => {
                    if (error || !result) {
                        reject(new BadRequestException('Cloudinary upload failed'));
                        return;
                    }
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                    });
                },
            );

            const readable = new Readable();
            readable.push(file.buffer);
            readable.push(null);
            readable.pipe(uploadStream);
        });
    }

    async deleteFile(publicId: string, isPdf = false): Promise<void> {
        await this.cloudinary.uploader.destroy(publicId, {
            resource_type: isPdf ? 'raw' : 'image',
        });
    }
}