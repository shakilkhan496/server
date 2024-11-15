import User from "../models/User";
import { BadRequest, ServerError } from "../utils/errors";

const getMyProfile = async (req, res) => {
  try {
    const { user } = req;

    const profile = await User.findById(user._id);
    if (!profile) return BadRequest(res, "Profile not found");

    res.send({ profile });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const { user, body } = req;
    const { name, password } = body;

    const profile = await User.findById(user._id);
    if (!profile) return BadRequest(res, "Profile not found");

    const userFieldsToUpdate = {};

    if (name) userFieldsToUpdate.name = name;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      userFieldsToUpdate.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      userFieldsToUpdate,
      {
        new: true,
      }
    );

    res.send({ user: updatedUser });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

export default { getMyProfile, updateMyProfile };
