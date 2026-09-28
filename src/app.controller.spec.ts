import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return a success payload", () => {
      const result = appController.getHello();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ greeting: "Welcome to Nest Template" });
    });
  });
});
