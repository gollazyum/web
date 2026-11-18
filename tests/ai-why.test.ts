import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { apiWhy } from "@/lib/claudeChat";

const err = (status: number, type: string, message: string) => new Anthropic.APIError(status, { type: "error", error: { type, message } }, message, new Headers());

describe("apiWhy", () => {
  it("names the cause without the key", () => {
    expect(apiWhy(err(401, "authentication_error", "invalid x-api-key"))).toBe("api_401_authentication_error");
    expect(apiWhy(err(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."))).toBe("api_400_credit");
    expect(apiWhy(err(404, "not_found_error", "model: claude-x"))).toBe("api_404_model");
    expect(apiWhy(err(429, "rate_limit_error", "Number of requests has exceeded your rate limit"))).toBe("api_429_rate_limit_error");
  });
});
