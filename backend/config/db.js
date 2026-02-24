// Db: Configuration level logic for the feature area.
import mongoose from "mongoose";

// Connect: Runs Connect flow. Inputs: none. Returns: a function result.
const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

export default connect;
