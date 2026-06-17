/*
    Project: Hoot Mobile
    -------------------

    File: ProfileActivityScreen.test.tsx

    Purpose:

        Protect the profile activity screen backed by the Lotide
        users/{id}/things API.

    Responsibilities:

        • Verify profile activity loads from the service layer
        • Verify comment activity navigates to the related post
        • Verify empty activity renders without crashing

    This file intentionally does NOT contain:

        • API transport tests
        • Account login tests
        • Moderation dashboard tests
*/

import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import configureStoreMock from "redux-mock-store";

import ProfileActivityScreen from "../ProfileActivityScreen";

const mockGetUserThings = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    text: "#111",
    secondaryText: "#444",
    secondaryBackground: "#eee",
    tint: "#f90",
  }),
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getUserThings: (...args: unknown[]) => mockGetUserThings(...args),
}));

const mockStore = configureStoreMock([]);

function renderWithStore(ui: React.ReactElement) {
  return render(
    <Provider
      store={mockStore({
        lotide: {
          ctx: {
            apiUrl: "https://lotide.fbxl.net/api/unstable",
            login: {
              token: "token-1",
              user: { id: 1, username: "sj_zero", host: "lotide.fbxl.net" },
            },
          },
        },
      })}
    >
      {ui}
    </Provider>,
  );
}

describe("ProfileActivityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserThings.mockResolvedValue({
      items: [
        {
          type: "comment",
          id: 44,
          content_html: "<p>Useful reply</p>",
          created: "2026-06-04T09:18:08.311607+00:00",
          post: {
            id: 12,
            title: "Parent post",
          },
        },
      ],
      next_page: null,
    });
  });

  test("loads activity and opens the related post for comments", async () => {
    const navigation = { navigate: jest.fn() };
    const route = {
      key: "profile-activity",
      name: "ProfileActivity",
      params: { userId: 1, username: "sj_zero" },
    };

    const screen = await renderWithStore(
      <ProfileActivityScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() => {
      expect(mockGetUserThings).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        1,
      );
      expect(screen.getByText("Parent post")).toBeTruthy();
      expect(screen.getByText("Useful reply")).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByRole("button", { name: "Open comment on Parent post" }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith("Post", {
      postId: 12,
      highlightedComments: [44],
    });
  });

  test("opens post activity directly", async () => {
    const navigation = { navigate: jest.fn() };
    const route = {
      key: "profile-activity",
      name: "ProfileActivity",
      params: { userId: 1, username: "sj_zero" },
    };
    mockGetUserThings.mockResolvedValue({
      items: [
        {
          type: "post",
          id: 55,
          title: "Original post",
          author: {
            id: 1,
            username: "sj_zero",
            host: "lotide.fbxl.net",
            local: true,
          },
          community: {
            id: 7,
            name: "lotide",
            host: "lotide.fbxl.net",
            local: true,
          },
        },
      ],
      next_page: null,
    });

    const screen = await renderWithStore(
      <ProfileActivityScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Original post")).toBeTruthy();
      expect(screen.getByText("lotide")).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByRole("button", { name: "Open post Original post" }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith("Post", {
      postId: 55,
    });
  });

  test("shows an empty state when the activity list is empty", async () => {
    const navigation = { navigate: jest.fn() };
    const route = {
      key: "profile-activity",
      name: "ProfileActivity",
      params: { userId: 1 },
    };
    mockGetUserThings.mockResolvedValue({
      items: [],
      next_page: null,
    });

    const screen = await renderWithStore(
      <ProfileActivityScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeTruthy();
    });
  });

  test("shows a friendly error when activity cannot be loaded", async () => {
    const navigation = { navigate: jest.fn() };
    const route = {
      key: "profile-activity",
      name: "ProfileActivity",
      params: { userId: 1 },
    };
    mockGetUserThings.mockRejectedValue(new Error("server unavailable"));

    const screen = await renderWithStore(
      <ProfileActivityScreen
        navigation={navigation as never}
        route={route as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot load activity")).toBeTruthy();
    });
  });
});

/* end of ProfileActivityScreen.test.tsx */
