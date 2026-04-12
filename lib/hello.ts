export type HelloMessage = {
  heading: string;
  subtitle: string;
};

export function getHelloMessage(): HelloMessage {
  return {
    heading: "Hello World",
    subtitle: "A clean Next.js App Router starter for ugit.",
  };
}
