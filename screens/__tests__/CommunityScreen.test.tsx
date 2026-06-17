/*
    Project: Hoot Mobile
    -------------------

    File: CommunityScreen.test.tsx

    Purpose:

        Validate community detail loading and feed wiring.

    Responsibilities:

        • Verify route community ids are resolved safely
        • Verify community feeds are scoped to the selected community
        • Verify follow and unfollow actions call the Lotide service

    This file intentionally does NOT contain:

        • Post list rendering tests
        • Edit community tests
        • Live Lotide community tests
*/

import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import CommunityScreen from "../CommunityScreen";

const mockGetCommunity = jest.fn();
const mockFollowCommunity = jest.fn();
const mockUnfollowCommunity = jest.fn();
const mockUseFeed = jest.fn();
const mockUseLotideCtx = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    secondaryBackground: "#eee",
    secondaryTint: "#0a0",
    tint: "#f90",
    text: "#000",
    blue: "#00f",
    green: "#0a0",
    secondaryText: "#888",
  }),
}));

jest.mock("../../hooks/useLotideCtx", () => ({
  __esModule: true,
  useLotideCtx: () => mockUseLotideCtx(),
}));

jest.mock("../../hooks/useFeed", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseFeed(...args),
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getCommunity: (...args: unknown[]) => mockGetCommunity(...args),
  followCommunity: (...args: unknown[]) => mockFollowCommunity(...args),
  unfollowCommunity: (...args: unknown[]) => mockUnfollowCommunity(...args),
}));

jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe("CommunityScreen", () => {
  const baseRoute = {
    key: "community",
    name: "Community",
    params: {
      community: {
        id: 12,
        name: "lotide",
        host: "lotide.fbxl.net",
        local: false,
        description: "A community",
        your_follow: { accepted: true },
        you_are_moderator: false,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFeed.mockReturnValue([[], jest.fn(), jest.fn()]);
    mockGetCommunity.mockResolvedValue(baseRoute.params.community);
    mockFollowCommunity.mockResolvedValue({ accepted: true });
    mockUnfollowCommunity.mockResolvedValue(undefined);
    mockUseLotideCtx.mockReturnValue({
      apiUrl: "https://lotide.fbxl.net/api/unstable",
      login: {
        token: "token-1",
        user: { id: 1, username: "sj_zero", host: "lotide.fbxl.net" },
      },
    });
  });

  test("loads and displays selected community", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={baseRoute as never}
      />,
    );

    await waitFor(() => {
      expect(mockGetCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        12,
      );
      expect(mockUseFeed).toHaveBeenCalledWith({
        sort: "hot",
        communityId: 12,
        enabled: true,
      });
      expect(screen.getByText("lotide")).toBeTruthy();
    });
  });

  test("loads full community data when route only has an id", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;
    const route = {
      ...baseRoute,
      params: { id: 12 },
    };
    let resolveCommunity: (community: typeof baseRoute.params.community) => void =
      () => {};
    mockGetCommunity.mockReturnValue(
      new Promise(resolve => {
        resolveCommunity = resolve;
      }),
    );

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={route as never}
      />,
    );

    expect(screen.getByText("Loading community")).toBeTruthy();
    resolveCommunity(baseRoute.params.community);

    await waitFor(() => {
      expect(mockGetCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        12,
      );
      expect(screen.getByText("lotide")).toBeTruthy();
    });
  });

  test("shows a friendly error when community params are missing", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;
    const route = {
      ...baseRoute,
      params: { community: undefined as unknown as never },
    };

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={route as never}
      />,
    );

    expect(screen.getByText("Cannot load community")).toBeTruthy();
    expect(mockGetCommunity).not.toHaveBeenCalled();
  });

  test("shows a friendly error when community fetch fails", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;
    mockGetCommunity.mockRejectedValue(new Error("boom"));

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={baseRoute as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot load community")).toBeTruthy();
    });
  });

  test("shows a retry action when the community feed cannot load", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;
    const retryFeed = jest.fn();
    mockUseFeed.mockReturnValue([[], jest.fn(), retryFeed, "Cannot load posts"]);

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={baseRoute as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot load posts")).toBeTruthy();
    });

    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    expect(retryFeed).toHaveBeenCalledTimes(1);
  });

  test("unfollows the displayed community and reloads it", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
    } as never;

    const screen = await render(
      <CommunityScreen
        navigation={navigation}
        route={baseRoute as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Unfollow")).toBeTruthy();
    });

    await fireEvent.press(screen.getByText("Unfollow"));

    await waitFor(() => {
      expect(mockUnfollowCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        12,
      );
      expect(mockGetCommunity).toHaveBeenCalledTimes(2);
    });
  });
});

/* end of CommunityScreen.test.tsx */
