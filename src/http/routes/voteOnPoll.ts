import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { redis } from '../../lib/redis';
import { voting } from '../../utils/votingPubSub';

export async function voteOnPoll(app:FastifyInstance ) {
    app.post('/polls/:pollId/votes', async (request, reply) => {
        const voteOnPollBody = z.object({
            pollOptionId: z.string().uuid(),
        });

        const voteOnPollParams = z.object({
            pollId: z.string().uuid(),
        });

        const { pollOptionId } = voteOnPollBody.parse(request.body);
        const { pollId } = voteOnPollParams.parse(request.params);

        let { sessionId } = request.cookies;

        if (sessionId) {
            const userPreviousVoteOnPoll = await prisma.vote.findUnique({
                where: {
                    sessionId_pollId: {
                        sessionId,
                        pollId,
                    },
                }
            });

            if (userPreviousVoteOnPoll && userPreviousVoteOnPoll.pollOptionId !== pollOptionId) {
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVoteOnPoll.id,
                    },
                });

                const votes = await redis.zincrby(pollId, -1, userPreviousVoteOnPoll.pollOptionId); // diminui a pontuacao do pollOptionId
                voting.publish(pollId, {
                    pollOptionId: userPreviousVoteOnPoll.pollOptionId,
                    votes: Number(votes),
                });
            } else if (userPreviousVoteOnPoll) {
                return reply.status(400).send({ message: "You already voted on this poll"  })
            }
        }

        if (!sessionId) {
            sessionId = randomUUID();
            reply.setCookie('sessionId', sessionId, {
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
                signed: true,
                httpOnly: true, // acessível somente pelo backend, front nao consegue acessar
            });
        };

        await prisma.vote.create({
            data: {
                sessionId,
                pollId,
                pollOptionId
            }
        });

        const totalVotes = await redis.zincrby(pollId, 1, pollOptionId) // incrementa em 1 o ranking da pollOptionId

        voting.publish(pollId, {
            pollOptionId,
            votes: Number(totalVotes),
        });

        return reply.status(201).send({ sessionId });
    });
}
