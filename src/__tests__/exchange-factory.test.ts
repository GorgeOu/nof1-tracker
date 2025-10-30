import { createExchangeService } from "../services/exchange-factory";
import { OkxService } from "../services/okx-service";

jest.mock("../services/okx-service", () => ({
  OkxService: jest.fn().mockImplementation(() => ({}))
}));

const MockedOkxService = OkxService as jest.MockedClass<typeof OkxService>;

describe("createExchangeService", () => {
  const originalEnv = { ...process.env };

  const envKeys = [
    "EXCHANGE",
    "OKX_API_KEY",
    "OKX_API_SECRET",
    "OKX_API_PASSPHRASE",
    "OKX_API_URL",
    "OKX_SIMULATED"
  ] as const;

  beforeEach(() => {
    MockedOkxService.mockClear();
    for (const key of envKeys) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const originalValue = (originalEnv as Record<string, string | undefined>)[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it("passes OKX_API_URL to OkxService constructor", () => {
    process.env.EXCHANGE = "okx";
    process.env.OKX_API_KEY = "key";
    process.env.OKX_API_SECRET = "secret";
    process.env.OKX_API_PASSPHRASE = "passphrase";
    process.env.OKX_API_URL = "https://aws.okx.com";

    createExchangeService();

    expect(MockedOkxService).toHaveBeenCalledWith(
      "key",
      "secret",
      "passphrase",
      false,
      "https://aws.okx.com"
    );
  });

  it("prefers options.baseUrl over environment variable", () => {
    createExchangeService({
      exchange: "okx",
      apiKey: "key",
      apiSecret: "secret",
      passphrase: "passphrase",
      baseUrl: "https://custom.okx.com"
    });

    expect(MockedOkxService).toHaveBeenCalledWith(
      "key",
      "secret",
      "passphrase",
      false,
      "https://custom.okx.com"
    );
  });
});
