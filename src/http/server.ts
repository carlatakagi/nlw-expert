import fastify from "fastify";
import { createPoll } from "./routes/createPoll";
import { getPoll } from "./routes/getPoll";
import { voteOnPoll } from "./routes/voteOnPoll";
import cookie from "@fastify/cookie";

const app = fastify();

app.register(cookie, {
    secret: "i-am-a-god", // pode assinar o cookie, é uma forma de garantir que o cookie que o usuário está enviando foi gerado pela aplicacao
    hook: 'onRequest',
});

app.register(createPoll)
app.register(getPoll)
app.register(voteOnPoll)

app.listen({ port: 3333 }).then(() => {
    console.log("HTTP server running!")
  })