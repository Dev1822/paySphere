const { updateSettings, getSettings } = require("../user.controller");
const User = require("../../models/user.model");

jest.mock("../../models/user.model");

describe("User Controller - updateSettings Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      userId: "user123",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test("should return 404 if user is not found when updating settings", async () => {
    req.body = { defaultOvertimeRate: 100, defaultDailyRate: 500 };
    User.findByIdAndUpdate.mockResolvedValue(null);

    await updateSettings(req, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      "user123",
      { defaultOvertimeRate: 100, defaultDailyRate: 500 },
      { new: true, runValidators: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  test("should return 400 if defaultOvertimeRate is negative", async () => {
    req.body = { defaultOvertimeRate: -50, defaultDailyRate: 500 };

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Default rates must be non-negative numbers" });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should return 400 if defaultDailyRate is negative", async () => {
    req.body = { defaultOvertimeRate: 100, defaultDailyRate: -200 };

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Default rates must be non-negative numbers" });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should return 400 if rates are invalid types", async () => {
    req.body = { defaultOvertimeRate: "invalid", defaultDailyRate: 500 };

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Default rates must be non-negative numbers" });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should successfully update settings and return 200", async () => {
    req.body = { defaultOvertimeRate: 150, defaultDailyRate: 600 };
    const updatedUser = {
      _id: "user123",
      defaultOvertimeRate: 150,
      defaultDailyRate: 600,
    };
    User.findByIdAndUpdate.mockResolvedValue(updatedUser);

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Settings updated successfully",
      settings: {
        defaultOvertimeRate: 150,
        defaultDailyRate: 600,
      },
    });
  });
});
