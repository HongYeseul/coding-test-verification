// 배포할 때 이 세 값과 manifest.json의 host_permissions를 함께 바꿉니다.
// publishable key는 브라우저에 노출되는 값이라 확장에 넣어도 됩니다.
// 관리자 키(SUPABASE_SECRET_KEY)는 절대 넣지 않습니다.
export const CONFIG = {
  appUrl: "http://localhost:3000",
  supabaseUrl: "http://127.0.0.1:54321",
  supabasePublishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
};
