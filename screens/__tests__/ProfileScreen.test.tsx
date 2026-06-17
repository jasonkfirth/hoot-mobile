/*
    Project: Hoot Mobile
    -------------------

    File: ProfileScreen.test.tsx

    Purpose:

        Validate the logged-in profile screen and its action list.

    Responsibilities:

        • Verify Lotide profile data and followed communities render
        • Verify profile load failures show a friendly error
        • Verify implemented profile actions navigate or dispatch correctly

    This file intentionally does NOT contain:

        • Login form tests
        • Storage logout persistence tests
        • Live Lotide profile tests
*/

import * as React from "react";
import { configureStore } from "redux-mock-store";
import { Provider } from "react-redux";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import ProfileScreen from "../ProfileScreen";

const mockGetUserData = jest.fn();
const mockGetCommunities = jest.fn();
const mockEmitter = {
  addListener: jest.fn(),
};

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    text: "#111",
    secondaryText: "#444",
    secondaryBackground: "#eee",
    tertiaryBackground: "#ddd",
    tint: "#09f",
    secondaryTint: "#999",
    placeholderText: "#999",
  }),
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getUserData: (...args: unknown[]) => mockGetUserData(...args),
  getCommunities: (...args: unknown[]) => mockGetCommunities(...args),
}));

jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter", () => {
  return jest.fn(() => mockEmitter);
});

const mockStore = configureStore([]);

describe("ProfileScreen", () => {
  const baseRoute = {
    key: "profile",
    name: "ProfileScreen",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserData.mockResolvedValue({
      id: 1,
      username: "sj_zero",
      host: "lotide.fbxl.net",
      local: true,
      description: {
        content_text: "I use Lotide everywhere.",
      },
    });
    mockGetCommunities.mockResolvedValue({
      items: [
        {
          id: 1,
          name: "lotide",
          host: "lotide.fbxl.net",
          local: false,
        },
      ],
      next_page: null,
    });
  });

  function renderWithContext(ui: React.ReactElement) {
    return render(
      <Provider
        store={mockStore({
          lotide: {
            ctx: {
              apiUrl: "https://lotide.fbxl.net/api/unstable",
              login: {
                token: "token-1",
                user: {
                  id: 1,
                  username: "sj_zero",
                  host: "lotide.fbxl.net",
                },
              },
            },
          },
        })}
      >
        {ui}
      </Provider>,
    );
  }

  test("renders profile data when user data loads", async () => {
    const navigation = { addListener: jest.fn() } as never;

    const screen = await renderWithContext(
      <ProfileScreen navigation={navigation} route={baseRoute as never} />,
    );

    await waitFor(() => {
      expect(mockGetUserData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockGetUserData).toHaveBeenCalledWith(
        expect.objectContaining({ apiUrl: "https://lotide.fbxl.net/api/unstable" }),
        1,
      );
    });

    expect(screen.getByText("sj_zero")).toBeTruthy();
    expect(screen.getByText("I use Lotide everywhere.")).toBeTruthy();
    expect(mockGetCommunities).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "https://lotide.fbxl.net/api/unstable" }),
      true,
    );
    expect(screen.getByText("lotide")).toBeTruthy();
  });

  test("shows a friendly load error when profile request fails", async () => {
    const navigation = { addListener: jest.fn() } as never;
    mockGetUserData.mockRejectedValue(new Error("cannot connect"));

    const screen = await renderWithContext(
      <ProfileScreen navigation={navigation} route={baseRoute as never} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot load profile")).toBeTruthy();
    });
  });

  test("shows implemented profile actions", async () => {
    const navigation = {
      addListener: jest.fn(),
      navigate: jest.fn(),
    };

    const screen = await renderWithContext(
      <ProfileScreen navigation={navigation as never} route={baseRoute as never} />,
    );

    await waitFor(() => {
      expect(screen.getByText("App Settings")).toBeTruthy();
    });

    expect(screen.queryByText("Edit Account")).toBeNull();
    expect(screen.queryByText("Your Posts / Comments")).toBeNull();
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Coming soon")).toBeNull();

    await fireEvent.press(
      screen.getByRole("button", { name: "Your Activity" }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith("ProfileActivity", {
      userId: 1,
      username: "sj_zero",
    });

    await fireEvent.press(screen.getByRole("button", { name: "Moderation" }));
    expect(navigation.navigate).toHaveBeenCalledWith("Moderation");

    await fireEvent.press(screen.getByRole("button", { name: "App Settings" }));
    expect(navigation.navigate).toHaveBeenCalledWith("Settings");
  });
});

/* end of ProfileScreen.test.tsx */
