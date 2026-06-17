/*
    Project: Hoot Mobile
    -------------------

    File: User.test.ts

    Purpose:

        Validate Lotide user service helpers that are used by profile
        and account screens.

    Responsibilities:

        • Verify profile activity uses the users/{id}/things endpoint
        • Verify pagination is passed to the profile activity endpoint

    This file intentionally does NOT contain:

        • Component rendering tests
        • Authentication lifecycle tests
        • Network integration tests against a live Lotide node
*/

import { getUserThings } from "../User";

describe("User service", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: [],
        next_page: null,
      }),
    });
  });

  test("loads user activity from the Lotide things endpoint", async () => {
    await getUserThings(
      {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
      },
      1,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://lotide.fbxl.net/api/unstable/users/1/things",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  test("passes pagination to the user activity endpoint", async () => {
    await getUserThings(
      {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
      },
      1,
      "page token&unsafe=true",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://lotide.fbxl.net/api/unstable/users/1/things?page=page%20token%26unsafe%3Dtrue",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  test("filters malformed and unknown user activity records", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: [
          {
            type: "post",
            id: 11,
            title: "Good post",
          },
          {
            type: "comment",
            id: 12,
            content_text: "Good comment",
            content_html: "<p>Good comment</p>",
            post: {
              id: 11,
              title: "Good post",
            },
          },
          {
            type: "comment",
            id: "bad",
            post: {
              id: 11,
              title: "Bad comment",
            },
          },
          {
            type: "future_type",
            id: 13,
          },
        ],
        next_page: 33,
      }),
    });

    const things = await getUserThings(
      {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
      },
      1,
    );

    expect(things).toEqual({
      items: [
        expect.objectContaining({
          type: "post",
          id: 11,
          title: "Good post",
        }),
        expect.objectContaining({
          type: "comment",
          id: 12,
          post: {
            id: 11,
            title: "Good post",
            remote_url: undefined,
            sensitive: undefined,
          },
        }),
      ],
      next_page: null,
    });
  });

  test("rejects malformed user activity envelopes", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: null,
        next_page: null,
      }),
    });

    await expect(
      getUserThings(
        {
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        },
        1,
      ),
    ).rejects.toThrow("Invalid Lotide API response");
  });
});

/* end of User.test.ts */
