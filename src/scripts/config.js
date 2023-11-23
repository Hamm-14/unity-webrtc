import {getServers} from "./icesettings.js";

export async function getServerConfig() {
  const protocolEndPoint = "http://127.0.0.1:80" + '/config';
  const createResponse = await fetch(protocolEndPoint);
  return await createResponse.json();
}

export function getRTCConfiguration() {
  let config = {};
  config.sdpSemantics = 'unified-plan';
  config.iceServers = getServers();
  return config;
}