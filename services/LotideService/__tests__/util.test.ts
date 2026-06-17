/*
    Project: Hoot Mobile
    -------------------

    File: util.test.ts

    Purpose:

        Validate low-level Lotide request utility behavior.

    Responsibilities:

        • Verify invalid JSON is reported with a friendly error
        • Verify HTTP errors retain status and response body metadata
        • Verify authenticated endpoints fail before issuing bad requests

    This file intentionally does NOT contain:

        • Endpoint-specific tests
        • React component tests
        • Live network integration tests
*/

import { lotideRequest, readJson } from "../util";

describe("Lotide service utilities", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("turns invalid JSON into a friendly error", async () => {
    await expect(
      readJson({
        json: jest.fn().mockRejectedValue(new Error("bad json")),
      } as unknown as Parameters<typeof readJson>[0]),
    ).rejects.toThrow("The Lotide server returned invalid JSON.");
  });

  test("sends JSON bodies with bearer authentication", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 7 }),
    });

    await lotideRequest(
      {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
        login: { token: "token-1" },
      },
      "POST",
      "posts",
      {
        title: "Lotide post",
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://lotide.fbxl.net/api/unstable/posts",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Lotide post",
        }),
      },
    );
  });

  test("keeps HTTP error status and body metadata", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("server exploded"),
    });

    await expect(
      lotideRequest(
        {
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        },
        "GET",
        "instance",
        undefined,
        true,
      ),
    ).rejects.toMatchObject({
      status: 500,
      body: "server exploded",
      method: "GET",
      path: "https://lotide.fbxl.net/api/unstable/instance",
    });
  });

  test("does not issue authenticated requests without a login", async () => {
    global.fetch = jest.fn();

    await expect(
      lotideRequest(
        {
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        },
        "GET",
        "users/~me/notifications",
      ),
    ).rejects.toThrow("Not logged in");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

/* end of util.test.ts */
