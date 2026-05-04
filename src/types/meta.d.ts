export type MetaCustomData = Record<string, string | number | boolean | undefined>;

export type MetaUserData = Record<string, string>;

export interface MetaTrackOptions extends MetaUserData {
  eventID?: string;
}

export interface MetaCAPIEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  user_data: MetaUserData;
  custom_data: MetaCustomData;
  event_source_url: string;
  action_source: string;
}

export interface MetaCAPIPayload {
  data: MetaCAPIEvent[];
  pixel_id: string;
}

declare global {
  interface Window {
    fbq: (
      action: string,
      event: string,
      data?: MetaCustomData,
      options?: MetaTrackOptions
    ) => void;
  }
}
