import axios from "axios";
import { OkxService } from "../services/okx-service";

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    create: jest.fn()
  };
});

const mockedAxiosCreate = axios.create as jest.MockedFunction<typeof axios.create>;

describe("OkxService", () => {
  beforeEach(() => {
    mockedAxiosCreate.mockReset();
  });

  it("throws helpful error when DNS lookup fails", async () => {
    const requestMock = jest.fn().mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOENT www.okx.com"), {
        code: "ENOTFOUND",
        isAxiosError: true
      })
    );

    mockedAxiosCreate.mockReturnValue({
      request: requestMock
    } as any);

    const service = new OkxService("key", "secret", "pass", false, "https://aws.okx.com");

    await expect(
      (service as any).request("GET", "/api/v5/public/time")
    ).rejects.toThrow("Unable to resolve OKX host at https://aws.okx.com");

    expect(mockedAxiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://aws.okx.com" })
    );
  });
});
