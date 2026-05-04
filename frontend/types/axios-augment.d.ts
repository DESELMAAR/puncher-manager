import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Skip global loading bar / spinner for this request */
    skipGlobalLoading?: boolean;
  }
}
