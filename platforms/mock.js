import { RetryablePlatformError } from "../errorHandling/errors.js";

export const mockPublisher = {
  async publish(payload) {
    if (Math.random() < 0.3) {
      throw new RetryablePlatformError("Temporary outage");
    }

    return { externalId: "mock_" + Date.now() };
  }
};