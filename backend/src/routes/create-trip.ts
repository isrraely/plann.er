import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import dayjs from "dayjs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";

export async function createTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post('/trips', {
        schema: {
            body: z.object({
                destination: z.string().min(4),
                starts_at: z.coerce.date(),
                ends_at: z.coerce.date(),
                owner_name: z.string(),
                owner_email: z.string().email(),
                emails_to_invite: z.array(z.string().email()),
            })
        }
    }, async (request) => {
        const { destination, starts_at, ends_at, owner_name, owner_email, emails_to_invite } = request.body

        if (dayjs(starts_at).isBefore(new Date())) {
            throw new Error("Start date cannot be in the past");
        }

        if (dayjs(ends_at).isBefore(starts_at)) {
            throw new Error("End date cannot be before start date");
        }



        const trip = await prisma.trip.create({
            data: {
                destination,
                starts_at,
                ends_at,
                Participant: {
                    createMany: {
                        data: [
                            {
                                name: owner_name,
                                email: owner_email,
                                is_owner: true,
                                is_confirmed: true,
                            },
                            ...emails_to_invite.map(email => ({
                                email,
                                is_owner: false,
                                is_confirmed: false,
                            }))
                        ]
                    }
                }
            }
        })

        const formattedStartDate = dayjs(starts_at).format('DD/MM/YYYY')

        const mail = await getMailClient()

        const message = await mail.sendMail({
            from: {
                name: 'Equipe plann.er',
                address: 'oi@plann.er'
            },
            to: {
                name: owner_name,
                address: owner_email,
            },
            subject: `Confirme sua viagem para ${destination}`,
            html: `
            
            <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
                <p>Você solicitou a criação de uma viagem para <strong>${destination}</strong>, Brasil nas datas de <strong>16 a 27 de Agosto de 2024</strong>.</p>
                <p></p>
                <p>Para confirmar sua viagem, clique no link abaixo:</p>
                <p></p>
                <p><a href="">Confirmar viagem</a></p>
                <p></p>
                <p>Caso esteja usando o dispositivo móvel, você também pode confirmar a criação da viagem pelos aplicativos:</p>
                <p></p>
                <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
            </div>
            `.trim(),
        })

        console.log(nodemailer.getTestMessageUrl(message))


        return { tripId: trip.id }
    })
}