/*
    Project: Hoot Mobile
    -------------------

    File: CommunityFinder.test.tsx

    Purpose:

        Validate the community picker used by post creation and
        community selection flows.

    Responsibilities:

        • Verify Lotide communities load from the service layer
        • Verify filtering does not select hidden communities
        • Verify failed loads and only-when-typing mode stay safe

    This file intentionally does NOT contain:

        • New post submit tests
        • Live Lotide network tests
        • Community detail screen tests
*/

import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import configureStoreMock from "redux-mock-store";

import CommunityFinder from "../CommunityFinder";

const mockGetCommunities = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    secondaryText: "#333",
    placeholderText: "#999",
    text: "#000",
    secondaryTint: "#090",
    tertiaryBackground: "#eee",
  }),
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getCommunities: (...args: unknown[]) => mockGetCommunities(...args),
}));

const mockStore = configureStoreMock([]);

function renderWithStore(ui: React.ReactElement, ctx: LotideContext = {}) {
  return render(<Provider store={mockStore({ lotide: { ctx } })}>{ui}</Provider>);
}

describe("CommunityFinder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCommunities.mockResolvedValue({
      items: [
        {
          id: 1,
          name: "lotide",
          host: "lotide.fbxl.net",
          local: false,
        },
        {
          id: 2,
          name: "narwhal",
          host: "narwhal.city",
          local: false,
        },
      ],
      next_page: null,
    });
  });

  test("renders communities and calls onSelect when a row is tapped", async () => {
    const onSelect = jest.fn();
    const screen = await renderWithStore(
      <CommunityFinder onSelect={onSelect} />,
      { login: { token: "token-1" } },
    );

    await waitFor(() => {
      expect(mockGetCommunities).toHaveBeenCalledTimes(1);
      expect(screen.getByText("lotide")).toBeTruthy();
      expect(screen.getByText("narwhal")).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Select community lotide@lotide.fbxl.net",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: "lotide",
      }),
    );
  });

  test("loads only followed communities when requested", async () => {
    await renderWithStore(
      <CommunityFinder onlyFollowing onSelect={() => {}} />,
      { login: { token: "token-1" } },
    );

    await waitFor(() => {
      expect(mockGetCommunities).toHaveBeenCalledWith(
        expect.objectContaining({
          login: { token: "token-1" },
        }),
        true,
      );
    });
  });

  test("filters community list when text is entered", async () => {
    const screen = await renderWithStore(<CommunityFinder onSelect={() => {}} />, {
      login: { token: "token-1" },
    });

    await waitFor(() => {
      expect(screen.getByText("lotide")).toBeTruthy();
      expect(screen.getByText("narwhal")).toBeTruthy();
    });

    await fireEvent.changeText(screen.getByPlaceholderText("Filter communities"), "narwh");

    await waitFor(() => {
      expect(screen.getByText("narwhal")).toBeTruthy();
      expect(screen.queryByText("lotide")).toBeNull();
    });
  });

  test("keeps results hidden until typing when requested", async () => {
    const screen = await renderWithStore(
      <CommunityFinder onlyWhenTyping onSelect={() => {}} />,
      { login: { token: "token-1" } },
    );

    await waitFor(() => {
      expect(mockGetCommunities).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("lotide")).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText("Filter communities"), "lot");

    await waitFor(() => {
      expect(screen.getByText("lotide")).toBeTruthy();
      expect(screen.queryByText("narwhal")).toBeNull();
    });
  });

  test("does not crash or expose stale rows when community loading fails", async () => {
    mockGetCommunities.mockRejectedValue(new Error("server unavailable"));

    const screen = await renderWithStore(<CommunityFinder onSelect={() => {}} />, {
      login: { token: "token-1" },
    });

    await waitFor(() => {
      expect(mockGetCommunities).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByPlaceholderText("Filter communities")).toBeTruthy();
    expect(screen.queryByText("lotide")).toBeNull();
    expect(screen.queryByText("narwhal")).toBeNull();
  });
});

/* end of CommunityFinder.test.tsx */
