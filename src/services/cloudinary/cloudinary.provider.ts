import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 } from "cloudinary"
import { CloudinaryConfig } from "../../config/cloudinary.config.js";

export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProviders: Provider = {
    provide: CLOUDINARY,
    useFactory: (configService: ConfigService): typeof v2 => {
        const config = configService.get<CloudinaryConfig>('cloudinary');

        if (!config) {
            throw new Error('Cloudinary configuration is missing');
        }

        v2.config({
            cloud_name: config.cloudName,
            api_key: config.apiKey,
            api_secret: config.apiSecret
        })

        return v2;
    },
    inject: [ConfigService]
}