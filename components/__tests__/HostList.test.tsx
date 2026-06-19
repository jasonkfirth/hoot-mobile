/*
    Project: Hoot Mobile
    -------------------

    File: HostList.test.tsx

    Purpose:

        Validate the Lotide host/profile picker shown during login.

    Responsibilities:

        • Verify known hosts and saved profiles render
        • Verify known hosts call onSelect only when compatible
        • Verify typed custom hostnames are normalized before selection

    This file intentionally does NOT contain:

        • Login form submission tests
        • Persistent storage implementation tests
        • Live instance discovery tests
*/

import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import configureStoreMock from "redux-mock-store";

import HostList from "../HostList";

const mockGetStore = jest.fn();
const mockGetInstanceInfo = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  __esModule: true,
  default: () => ({
    background: "#fff",
    secondaryText: "#333",
    secondaryBackground: "#ddd",
    tertiaryBackground: "#eee",
  }),
}));

jest.mock("react-redux", () => ({
  ...jest.requireActual("react-redux"),
  useDispatch: () => jest.fn(),
}));

jest.mock("../../services/StorageService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/StorageService"),
  lotideContextKV: {
    ...jest.requireActual("../../services/StorageService").lotideContextKV,
    getStore: (...args: unknown[]) => mockGetStore(...args),
  },
}));

jest.mock("../../services/LotideService", () => ({
  __esModule: true,
  ...jest.requireActual("../../services/LotideService"),
  getInstanceInfo: (...args: unknown[]) => mockGetInstanceInfo(...args),
}));

const mockStore = configureStoreMock([]);

function renderWithStore(ui: React.ReactElement, ctx: LotideContext = {}) {
  return render(<Provider store={mockStore({ lotide: { ctx } })}>{ui}</Provider>);
}

describe("HostList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStore.mockResolvedValue({});
    mockGetInstanceInfo.mockResolvedValue({
      software: { name: "Hoot", version: "0.19.0" },
      apiVersion: 19,
    });
  });

  test("renders the seeded known hosts and existing profiles", async () => {
    mockGetStore.mockResolvedValue({
      "alice@https://lotide.fbxl.net": {
        login: { user: { id: 1, username: "alice" } },
        apiUrl: "https://lotide.fbxl.net",
      },
    });

    const onSelect = jest.fn();

    const screen = await renderWithStore(<HostList onSelect={onSelect} />);

    expect(screen.getByText("Login to continue")).toBeTruthy();
    expect(screen.getByText("Or sign into a new account")).toBeTruthy();
    expect(screen.getByPlaceholderText("Host domain")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText("FBXL Lotide").length).toBeGreaterThan(0);
      expect(screen.getByText("Narwhal City")).toBeTruthy();
      expect(screen.getByText("Narwhal City (Dev)")).toBeTruthy();
      expect(screen.getAllByText("Hoot 0.19.0")).toHaveLength(3);
    });

    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getAllByText("lotide.fbxl.net").length).toBeGreaterThan(0);
  });

  test("filters hosts and selects the chosen host", async () => {
    const onSelect = jest.fn();

    const screen = await renderWithStore(<HostList onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText("Hoot 0.19.0")).toHaveLength(3);
    });

    await fireEvent.press(
      screen.getByRole("button", { name: "Select host FBXL Lotide" }),
    );
    expect(onSelect).toHaveBeenCalledWith("lotide.fbxl.net", "FBXL Lotide");

    await fireEvent.changeText(screen.getByPlaceholderText("Host domain"), "narwhal");

    await waitFor(() => {
      expect(screen.getByText("Narwhal City")).toBeTruthy();
      expect(screen.getByText("Narwhal City (Dev)")).toBeTruthy();
    });
    expect(screen.queryByText("FBXL Lotide")).toBeNull();
  });

  test("does not select hosts whose API version is too old", async () => {
    mockGetInstanceInfo.mockResolvedValue({
      software: { name: "Lotide", version: "0.7.0" },
      apiVersion: 7,
    });
    const onSelect = jest.fn();

    const screen = await renderWithStore(<HostList onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Out of date/)).toHaveLength(3);
    });

    const lotideButton = screen.getByRole("button", {
      name: "Select host FBXL Lotide",
    });
    expect(lotideButton.props.accessibilityState).toEqual({
      disabled: true,
    });
    await fireEvent.press(lotideButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("selects hosts at the minimum supported API version", async () => {
    mockGetInstanceInfo.mockResolvedValue({
      software: { name: "Lotide", version: "0.8.0" },
      apiVersion: 8,
    });
    const onSelect = jest.fn();

    const screen = await renderWithStore(<HostList onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText("Lotide 0.8.0")).toHaveLength(3);
    });

    await fireEvent.press(
      screen.getByRole("button", { name: "Select host FBXL Lotide" }),
    );
    expect(onSelect).toHaveBeenCalledWith("lotide.fbxl.net", "FBXL Lotide");
  });

  test("submits a typed custom host in lowercase", async () => {
    const onSelect = jest.fn();
    const screen = await renderWithStore(<HostList onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Host domain");

    await waitFor(() => {
      expect(screen.getAllByText("Hoot 0.19.0")).toHaveLength(3);
    });

    await fireEvent.changeText(input, "LoTiDe.FBXL.NET");
    await fireEvent(input, "submitEditing");

    expect(onSelect).toHaveBeenCalledWith("lotide.fbxl.net");
  });
});

/* end of HostList.test.tsx */
