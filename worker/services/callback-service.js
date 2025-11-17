const axios = require("axios");
const redisService = require("./redis-service");

async function sendCallback(jobId, callbackUrl, payload, finalStatus) {
  try {
    const response = await axios.post(callbackUrl, payload);
    await redisService.updateJobStatus(jobId, finalStatus, {
      callbackStatus: "sent",
      callbackStatusCode: response.status,
      callbackError: null,
    });
    console.log(`Sent callback to ${callbackUrl}`);
    return { success: true, status: response.status };
  } catch (error) {
    await redisService.updateJobStatus(jobId, finalStatus, {
      callbackStatus: "failed",
      callbackError: error.message,
      callbackStatusCode: error.response ? error.response.status : null,
    });
    console.error(`Failed to send callback to ${callbackUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendCallback,
};
