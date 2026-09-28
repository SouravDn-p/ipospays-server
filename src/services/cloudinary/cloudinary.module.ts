import { Module } from "@nestjs/common";
import { CloudinaryProviders } from "./cloudinary.provider.js";

@Module({
    providers: [CloudinaryProviders],
    exports: [CloudinaryProviders]
})
export class Cloudinary { }