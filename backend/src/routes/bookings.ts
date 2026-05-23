import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT r.*,
              v.make,
              v.model,
              v.license_plate,
              v.category
       FROM rentals r
       JOIN vehicles v ON v.vehicle_id = r.vehicle_id
       WHERE r.renter_id = $1 OR v.owner_id = $1
       ORDER BY r.start_date DESC`,
      [userId]
    );

    return res.json({ bookings: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load bookings' });
  }
});

router.get('/:id', async (req, res) => {
  const userId = (req as AuthRequest).user?.userId;
  const bookingId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT r.*,
              v.make,
              v.model,
              v.license_plate,
              v.category,
              v.owner_id
       FROM rentals r
       JOIN vehicles v ON v.vehicle_id = r.vehicle_id
       WHERE r.rental_id = $1`,
      [bookingId]
    );

    const booking = result.rows[0];
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.renter_id !== userId && booking.owner_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json({ booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load booking' });
  }
});

router.post(
  '/',
  body('vehicleId').isUUID(),
  body('pickupLocationId').isUUID(),
  body('dropoffLocationId').isUUID(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user?.userId;
    const { vehicleId, pickupLocationId, dropoffLocationId, startDate, endDate } = req.body;

    try {
      const availability = await pool.query(
        'SELECT is_vehicle_available($1::uuid, $2::timestamp, $3::timestamp) AS available',
        [vehicleId, startDate, endDate]
      );

      if (!availability.rows[0]?.available) {
        return res.status(409).json({ message: 'Vehicle is not available for requested dates' });
      }

      const vehicleResult = await pool.query('SELECT daily_rate, owner_id FROM vehicles WHERE vehicle_id = $1', [vehicleId]);
      const vehicle = vehicleResult.rows[0];
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
      const totalAmount = Number(vehicle.daily_rate) * days;
      const ownerEarnings = Number((totalAmount * 0.7).toFixed(2));
      const platformCommission = Number((totalAmount * 0.3).toFixed(2));
      const bookingReference = `RH${Date.now().toString().slice(-8)}`;

      const insert = await pool.query(
        `INSERT INTO rentals (
           booking_reference,
           vehicle_id,
           renter_id,
           pickup_location_id,
           dropoff_location_id,
           start_date,
           end_date,
           total_amount,
           owner_earnings,
           platform_commission,
           status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         RETURNING *`,
        [
          bookingReference,
          vehicleId,
          userId,
          pickupLocationId,
          dropoffLocationId,
          startDate,
          endDate,
          totalAmount,
          ownerEarnings,
          platformCommission
        ]
      );

      return res.status(201).json({ booking: insert.rows[0] });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to create booking' });
    }
  }
);

router.put('/:id/cancel', async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  const bookingId = req.params.id;

  try {
    const rentalResult = await pool.query('SELECT renter_id, status FROM rentals WHERE rental_id = $1', [bookingId]);
    const rental = rentalResult.rows[0];
    if (!rental) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (rental.renter_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (rental.status !== 'pending' && rental.status !== 'active') {
      return res.status(400).json({ message: 'Booking cannot be cancelled' });
    }

    await pool.query('UPDATE rentals SET status = $1 WHERE rental_id = $2', ['cancelled', bookingId]);
    return res.json({ message: 'Booking cancelled' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

router.put('/:id/extend', body('endDate').isISO8601(), async (req: AuthRequest, res) => {
  const userId = req.user?.userId;
  const bookingId = req.params.id;
  const { endDate } = req.body;

  try {
    const rentalResult = await pool.query('SELECT renter_id, end_date, vehicle_id, status FROM rentals WHERE rental_id = $1', [bookingId]);
    const rental = rentalResult.rows[0];
    if (!rental) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (rental.renter_id !== userId || rental.status !== 'active') {
      return res.status(403).json({ message: 'Forbidden or booking not active' });
    }

    const availability = await pool.query(
      'SELECT is_vehicle_available($1::uuid, $2::timestamp, $3::timestamp) AS available',
      [rental.vehicle_id, rental.end_date, endDate]
    );
    if (!availability.rows[0]?.available) {
      return res.status(409).json({ message: 'Vehicle is unavailable for the extension period' });
    }

    await pool.query('UPDATE rentals SET end_date = $1 WHERE rental_id = $2', [endDate, bookingId]);
    return res.json({ message: 'Booking extended' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to extend booking' });
  }
});

router.put('/:id/complete', async (_req: AuthRequest, res) => {
  const bookingId = _req.params.id;

  try {
    const rentalResult = await pool.query('SELECT status FROM rentals WHERE rental_id = $1', [bookingId]);
    const rental = rentalResult.rows[0];
    if (!rental) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (rental.status !== 'active') {
      return res.status(400).json({ message: 'Booking is not active' });
    }

    await pool.query('UPDATE rentals SET status = $1, actual_return_date = NOW() WHERE rental_id = $2', ['completed', bookingId]);
    return res.json({ message: 'Booking completed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to complete booking' });
  }
});

export default router;
