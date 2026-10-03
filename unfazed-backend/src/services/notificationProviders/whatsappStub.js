export const whatsappStub = {
  async send(job) {
    // The persisted NotificationJob is the stub queue; never contact WhatsApp.
    return {
      status: 'stubbed',
      providerMessageId: `stub:${job.id}`,
      detail: 'WhatsApp stub queued; no message was sent.',
    };
  },
};
