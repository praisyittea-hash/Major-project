import Package from '../models/Package.js';
import ClientPackage from '../models/ClientPackage.js';
import Session from '../models/Session.js';
import Therapist from '../models/Therapist.js';
import { HttpError } from '../middleware/errorHandler.js';
export async function updateProfile(req, res) {
  if (req.body.services) {
    const retained = new Set(req.body.services.map((service) => String(service._id || '')));
    const removed = req.therapist.services
      .filter((service) => !retained.has(service.id))
      .map((service) => service._id);
    if (removed.length) {
      const [offers, purchases, appointments] = await Promise.all([
        Package.exists({ therapist: req.therapist.id, serviceId: { $in: removed } }),
        ClientPackage.exists({ therapist: req.therapist.id, serviceId: { $in: removed } }),
        Session.exists({ therapist: req.therapist.id, serviceId: { $in: removed } }),
      ]);
      if (offers || purchases || appointments)
        throw new HttpError(
          409,
          'Services referenced by appointments or packages must be retained. Edit the service instead.',
        );
    }
  }
  const allowed = ['slug', 'name', 'bio', 'specializations', 'languages', 'timezone', 'services'];
  for (const key of allowed) if (req.body[key] !== undefined) req.therapist[key] = req.body[key];
  if (
    req.body.slug &&
    (await Therapist.exists({ slug: req.body.slug, _id: { $ne: req.therapist.id } }))
  )
    throw new HttpError(409, 'This branded link is taken');
  await req.therapist.save();
  res.json({ therapist: req.therapist });
}
