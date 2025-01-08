declare namespace NodeJS {
    interface ProcessEnv {
      SENS_ACCESS_KEY: string;
      SENS_SECRET_KEY: string;
      SENS_SERVICE_ID: string;
      SENDER_PHONE: string;
      PORT?: string; // 포트 번호는 선택 사항
    }
  }
  