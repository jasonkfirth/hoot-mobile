/*
    Project: Hoot Mobile
    -------------------

    File: NewPostScreen.test.tsx

    Purpose:

        Protect the new post flow from community selection through
        successful and failed submit attempts.

    Responsibilities:

        • Verify the community picker loads communities when opened
        • Verify valid submissions call the Lotide post APIs
        • Verify failed submissions show a friendly alert

    This file intentionally does NOT contain:

        • Login and storage lifecycle validation
        • Live Lotide network tests
*/

import * as React from "react";
import { Alert } from "react-native";
import { Provider } from "react-redux";
import configureStoreMock from "redux-mock-store";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import NewPostScreen from "../NewPostScreen";

const mockGetCommunities = jest.fn();
const mockGetInstanceInfo = jest.fn();
const mockSubmitPost = jest.fn();
const mockGetPost = jest.fn();
const mockSuggestLoginRender = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    secondaryText: "#333",
    placeholderText: "#999",
    text: "#000",
  }),
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getCommunities: (...args: unknown[]) => mockGetCommunities(...args),
  getInstanceInfo: (...args: unknown[]) => mockGetInstanceInfo(...args),
  submitPost: (...args: unknown[]) => mockSubmitPost(...args),
  getPost: (...args: unknown[]) => mockGetPost(...args),
}));

jest.mock("../../components/SuggestLogin", () => ({
  __esModule: true,
  default: () => {
    mockSuggestLoginRender();
    return null;
  },
}));

const mockStore = configureStoreMock([]);

async function renderWithStore(ui: React.ReactElement) {
  const store = mockStore({
    lotide: {
      ctx: {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
        login: { token: "token-1" },
      },
    },
  });

  return {
    store,
    screen: await render(
      <Provider store={store}>{ui}</Provider>,
    ),
  };
}

function renderWithoutLogin(ui: React.ReactElement) {
  return render(
    <Provider
      store={mockStore({
        lotide: {
          ctx: {},
        },
      })}
    >
      {ui}
    </Provider>
  );
}

describe("NewPostScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInstanceInfo.mockResolvedValue({
      software: { name: "Lotide", version: "0.19.0" },
      apiVersion: 19,
    });
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
    mockSubmitPost.mockResolvedValue({ id: 99 });
    mockGetPost.mockResolvedValue({
      id: 99,
      title: "Lotide launch",
      community: {
        id: 1,
        name: "lotide",
        host: "lotide.fbxl.net",
        local: false,
      },
    });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("opens community chooser and loads communities", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
      navigate: jest.fn(),
    };
    const route = {
      key: "new-post",
      name: "NewPostScreen",
      params: { community: undefined },
    };

    const { screen } = await renderWithStore(
      <NewPostScreen navigation={navigation as never} route={route as never} />,
    );

    expect(screen.getByText("Select a Community")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Select community" }));

    await waitFor(() => {
      expect(mockGetCommunities).toHaveBeenCalledTimes(1);
      expect(screen.getByPlaceholderText("Filter communities")).toBeTruthy();
      expect(screen.getByText("lotide")).toBeTruthy();
      expect(screen.getByText("narwhal")).toBeTruthy();
    });
  });

  test("submits a post after a community and title are provided", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
      navigate: jest.fn(),
    };
    const route = {
      key: "new-post",
      name: "NewPostScreen",
      params: {
        community: {
          id: 1,
          name: "lotide",
          host: "lotide.fbxl.net",
          local: false,
        },
      },
    };

    const { store, screen } = await renderWithStore(
      <NewPostScreen navigation={navigation as never} route={route as never} />,
    );

    await fireEvent.changeText(
      screen.getByPlaceholderText("Add a Title"),
      "Lotide launch",
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Link"),
      "https://lotide.fbxl.net",
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Add post content"),
      "Hello Lotide",
    );
    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockSubmitPost).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        {
          community: 1,
          title: "Lotide launch",
          href: "https://lotide.fbxl.net",
          content_markdown: "Hello Lotide",
        },
      );
      expect(mockGetPost).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        }),
        99,
      );
      expect(navigation.navigate).toHaveBeenCalledWith("Post", { postId: 99 });
    });
    expect(store.getActions()).toContainEqual({
      type: "posts/setPost",
      payload: {
        post: expect.objectContaining({
          id: 99,
          title: "Lotide launch",
        }),
      },
    });
  });

  test("shows a friendly alert when post submission fails", async () => {
    mockSubmitPost.mockRejectedValue(new Error("server rejected post"));
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
      navigate: jest.fn(),
    };
    const route = {
      key: "new-post",
      name: "NewPostScreen",
      params: {
        community: {
          id: 1,
          name: "lotide",
          host: "lotide.fbxl.net",
          local: false,
        },
      },
    };

    const { screen } = await renderWithStore(
      <NewPostScreen navigation={navigation as never} route={route as never} />,
    );

    await fireEvent.changeText(
      screen.getByPlaceholderText("Add a Title"),
      "Lotide launch",
    );
    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Could not submit post",
        "server rejected post",
      );
    });
    expect(mockGetPost).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test("shows the login prompt when no account is active", async () => {
    const navigation = {
      addListener: jest.fn().mockReturnValue(() => {}),
      navigate: jest.fn(),
    };
    const route = {
      key: "new-post",
      name: "NewPostScreen",
      params: { community: undefined },
    };

    const screen = await renderWithoutLogin(
      <NewPostScreen navigation={navigation as never} route={route as never} />,
    );

    expect(mockSuggestLoginRender).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText("Add a Title")).toBeNull();
    expect(mockGetCommunities).not.toHaveBeenCalled();
  });
});

/* end of NewPostScreen.test.tsx */
