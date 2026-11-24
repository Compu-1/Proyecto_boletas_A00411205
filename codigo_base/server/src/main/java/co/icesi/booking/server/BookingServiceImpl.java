package co.icesi.booking.server;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.zeroc.Ice.Current;

import BookingApp.BookingException;
import BookingApp.BookingRecord;
import BookingApp.BookingResult;
import BookingApp.BookingService;
import BookingApp.EventInfo;
import BookingApp.InvalidBookingException;
import BookingApp.LockExpiredException;
import BookingApp.LockResult;
import BookingApp.Seat;
import BookingApp.SeatNotAvailableException;
import BookingApp.SeatNotFoundException;
import BookingApp.SeatState;
import BookingApp.SeatZone;

/**
 * Implementación del servicio remoto de reservas.
 *
 * CONCURRENCIA:
 * ZeroC Ice atiende cada petición en un hilo distinto de su "thread pool"
 * (hasta 100 hilos, ver BookingServerApp). Todos esos hilos comparten el
 * mismo objeto BookingServiceImpl y, por lo tanto, el mismo mapa de sillas.
 *
 * Para evitar condiciones de carrera (dos clientes bloqueando la misma silla)
 * todos los métodos públicos que leen o modifican el inventario son
 * "synchronized": Java garantiza que solo UN hilo a la vez puede estar
 * dentro de cualquiera de ellos (todos usan el mismo candado: "this").
 * Así, la secuencia "revisar si está libre -> marcarla como LOCKED"
 * se vuelve atómica (indivisible).
 */
public class BookingServiceImpl implements BookingService {

    public static final long DEFAULT_LOCK_DURATION_SECONDS = 90;

    private final EventInfo eventInfo;
    private final Map<String, Seat> seatsMap = new HashMap<>();
    private final List<BookingRecord> bookingsList = new ArrayList<>();

    public BookingServiceImpl() {
        this.eventInfo = new EventInfo(
                "EVT-2026-LIVE",
                "Concierto Icesi Live Rock & Pop 2026",
                "2026-11-28 20:00",
                "Auditorio Manuelita - Universidad Icesi",
                90, 90, 0, 0,
                120000.0, 75000.0, 45000.0
        );
        initSeats();
    }

    private void initSeats() {
        seatsMap.clear();
        bookingsList.clear();

        createSeatsForZone("A", 1, 10, SeatZone.ZONEVIP, 120000.0);
        createSeatsForZone("B", 1, 10, SeatZone.ZONEVIP, 120000.0);

        createSeatsForZone("C", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("D", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("E", 1, 10, SeatZone.ZONEPLATEA, 75000.0);

        createSeatsForZone("F", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("G", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("H", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("I", 1, 10, SeatZone.ZONEGENERAL, 45000.0);

        updateEventCounters();
        System.out.printf("[INFO] Inventario inicializado con %d sillas en 3 zonas (VIP, Platea, General).%n", seatsMap.size());
    }

    private void createSeatsForZone(String row, int startNum, int endNum, SeatZone zone, double price) {
        for (int num = startNum; num <= endNum; num++) {
            String seatId = String.format("%s-%d", row, num);
            Seat seat = new Seat(
                    seatId,
                    zone,
                    row,
                    num,
                    price,
                    SeatState.AVAILABLE,
                    "",
                    0L,
                    DEFAULT_LOCK_DURATION_SECONDS
            );
            seatsMap.put(seatId, seat);
        }
    }

    private boolean isLockExpired(Seat seat) {
        if (seat.state != SeatState.LOCKED) return false;
        long elapsedSeconds = (System.currentTimeMillis() - seat.lockTimestamp) / 1000L;
        return elapsedSeconds >= seat.lockDurationSeconds;
    }

    /**
     * Liberación automática: recorre todas las sillas y devuelve a AVAILABLE
     * las que siguen LOCKED pero ya superaron sus 90 segundos.
     * Se llama al inicio de cada operación pública, así nadie ve nunca
     * una silla "bloqueada" cuyo tiempo ya se venció.
     * (Siempre se invoca desde métodos synchronized.)
     */
    private void releaseExpiredLocks() {
        for (Seat seat : seatsMap.values()) {
            if (isLockExpired(seat)) {
                System.out.printf("[LOCK-EXPIRED] El bloqueo de la silla %s (cliente %s) expiró. Liberando.%n",
                        seat.id, seat.lockedByClientId);
                seat.state = SeatState.AVAILABLE;
                seat.lockedByClientId = "";
                seat.lockTimestamp = 0L;
            }
        }
    }

    private void updateEventCounters() {
        int avail = 0;
        int locked = 0;
        int booked = 0;
        for (Seat s : seatsMap.values()) {
            if (s.state == SeatState.BOOKED) {
                booked++;
            } else if (s.state == SeatState.LOCKED && !isLockExpired(s)) {
                locked++;
            } else {
                avail++;
            }
        }
        eventInfo.totalSeats = seatsMap.size();
        eventInfo.availableSeats = avail;
        eventInfo.lockedSeats = locked;
        eventInfo.bookedSeats = booked;
    }

    // Se devuelven COPIAS (clone) para que Ice envíe por la red una "foto"
    // estable de la silla, aunque otro hilo la modifique justo después.

    @Override
    public synchronized EventInfo getEventInfo(Current current) {
        releaseExpiredLocks();
        updateEventCounters();
        return eventInfo.clone();
    }

    @Override
    public synchronized Seat[] getAllSeats(Current current) {
        releaseExpiredLocks();
        List<Seat> list = new ArrayList<>();
        for (Seat s : seatsMap.values()) {
            list.add(s.clone());
        }
        list.sort(Comparator.comparing((Seat s) -> s.row).thenComparingInt(s -> s.number));
        return list.toArray(new Seat[0]);
    }

    @Override
    public synchronized Seat[] getSeatsByZone(SeatZone zone, Current current) {
        releaseExpiredLocks();
        List<Seat> list = new ArrayList<>();
        for (Seat s : seatsMap.values()) {
            if (s.zone == zone) {
                list.add(s.clone());
            }
        }
        list.sort(Comparator.comparing((Seat s) -> s.row).thenComparingInt(s -> s.number));
        return list.toArray(new Seat[0]);
    }

    @Override
    public synchronized Seat getSeat(String seatId, Current current) throws SeatNotFoundException {
        releaseExpiredLocks();
        Seat seat = seatsMap.get(seatId);
        if (seat == null) {
            throw new SeatNotFoundException("Silla no encontrada en inventario: " + seatId);
        }
        return seat.clone();
    }

    /**
     * SECCIÓN CRÍTICA PRINCIPAL.
     * Gracias a "synchronized", si 10 hilos llaman lockSeat("A-1") al mismo
     * tiempo, entran uno por uno: el primero la encuentra AVAILABLE y la
     * bloquea; los otros 9 ya la encuentran LOCKED y reciben
     * SeatNotAvailableException.
     */
    @Override
    public synchronized LockResult lockSeat(String seatId, String clientId, Current current)
            throws SeatNotFoundException, SeatNotAvailableException {

        releaseExpiredLocks();

        Seat seat = seatsMap.get(seatId);
        if (seat == null) {
            throw new SeatNotFoundException("Silla no encontrada: " + seatId);
        }

        // Validación de disponibilidad
        if (seat.state != SeatState.AVAILABLE) {
            if (seat.state == SeatState.LOCKED && clientId.equals(seat.lockedByClientId)) {
                // El mismo cliente renueva el bloqueo
                seat.lockTimestamp = System.currentTimeMillis();
                long expiresAt = seat.lockTimestamp + (seat.lockDurationSeconds * 1000L);
                System.out.printf("[LOCK-RENEW] Silla %s renovada para cliente: %s%n", seatId, clientId);
                return new LockResult(true, seatId, "Bloqueo renovado con éxito.", expiresAt);
            }
            System.out.printf("[LOCK-REJECTED] Silla %s rechazada para cliente: %s (Estado: %s)%n",
                    seatId, clientId, seat.state);
            throw new SeatNotAvailableException(String.format("La silla %s ya no se encuentra disponible (Estado: %s).", seatId, seat.state));
        }

        // Simulación de latencia de red / I/O en base de datos (No remover)
        try {
            Thread.sleep(25);
        } catch (InterruptedException ignored) {
        }

        seat.state = SeatState.LOCKED;
        seat.lockedByClientId = clientId;
        seat.lockTimestamp = System.currentTimeMillis();
        seat.lockDurationSeconds = DEFAULT_LOCK_DURATION_SECONDS;

        long expiresAt = seat.lockTimestamp + (DEFAULT_LOCK_DURATION_SECONDS * 1000L);
        System.out.printf("[LOCK-OK] Silla %s bloqueada exitosamente para cliente: %s (expira en %ds)%n",
                seatId, clientId, DEFAULT_LOCK_DURATION_SECONDS);

        return new LockResult(true, seatId, "Silla bloqueada exitosamente.", expiresAt);
    }

    @Override
    public synchronized boolean releaseSeat(String seatId, String clientId, Current current) throws SeatNotFoundException {
        releaseExpiredLocks();

        Seat seat = seatsMap.get(seatId);
        if (seat == null) {
            throw new SeatNotFoundException("Silla no encontrada: " + seatId);
        }

        // Solo puede liberar el cliente que la bloqueó
        if (seat.state == SeatState.LOCKED && clientId.equals(seat.lockedByClientId)) {
            seat.state = SeatState.AVAILABLE;
            seat.lockedByClientId = "";
            seat.lockTimestamp = 0L;
            System.out.printf("[RELEASE-OK] Silla %s liberada por cliente: %s%n", seatId, clientId);
            return true;
        }
        return false;
    }

    /**
     * Confirmación de compra en dos pasos, ambos dentro del mismo bloque
     * synchronized: primero se validan TODAS las sillas y solo si todas
     * son válidas se marcan como BOOKED (todo o nada).
     */
    @Override
    public synchronized BookingResult confirmBooking(String[] seatIds, String clientId, String customerName, String customerEmail, Current current)
            throws InvalidBookingException, BookingException {

        if (seatIds == null || seatIds.length == 0) {
            throw new InvalidBookingException("Debe seleccionar al menos una silla para completar la reserva.");
        }
        if (customerName == null || customerName.trim().isEmpty()) {
            throw new InvalidBookingException("El nombre del comprador es obligatorio.");
        }
        if (customerEmail == null || !customerEmail.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new InvalidBookingException("El correo electrónico del comprador es inválido.");
        }

        double totalAmount = 0.0;
        List<Seat> validatedSeats = new ArrayList<>();

        // Paso 1: Validación de TODAS las sillas antes de modificar alguna
        for (String seatId : seatIds) {
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no existe: " + seatId);
            }
            if (seat.state == SeatState.BOOKED) {
                throw new BookingException("La silla " + seatId + " ya fue vendida definitivamente.");
            }
            if (seat.state == SeatState.LOCKED && isLockExpired(seat)) {
                throw new LockExpiredException("El bloqueo temporal de la silla " + seatId + " ha expirado.");
            }
            if (seat.state != SeatState.LOCKED) {
                // Una silla AVAILABLE no se puede comprar sin haberla bloqueado antes
                // (normalmente significa que su bloqueo expiró y ya fue liberada).
                throw new LockExpiredException("La silla " + seatId + " no tiene un bloqueo vigente. Selecciónela de nuevo.");
            }
            if (!clientId.equals(seat.lockedByClientId)) {
                throw new BookingException("La silla " + seatId + " se encuentra bloqueada por otro comprador.");
            }
            totalAmount += seat.price;
            validatedSeats.add(seat);
        }

        // Paso 2: Confirmación y cambio a BOOKED (atómico gracias a synchronized)
        for (Seat s : validatedSeats) {
            s.state = SeatState.BOOKED;
            s.lockedByClientId = clientId;
        }

        String bookingCode = "RES-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        long now = System.currentTimeMillis();

        BookingRecord record = new BookingRecord(
                bookingCode,
                eventInfo.id,
                clientId,
                customerName.trim(),
                customerEmail.trim(),
                seatIds,
                totalAmount,
                now
        );
        bookingsList.add(record);

        System.out.printf("[BOOKING-CONFIRMED] Código: %s | Cliente: %s (%s) | %d sillas | Total: $%,.0f COP%n",
                bookingCode, customerName, clientId, seatIds.length, totalAmount);

        return new BookingResult(
                true,
                bookingCode,
                "Reserva confirmada con éxito. Disfrute del evento.",
                seatIds,
                totalAmount,
                now
        );
    }

    @Override
    public synchronized Seat[] getMyLockedSeats(String clientId, Current current) {
        releaseExpiredLocks();
        List<Seat> list = new ArrayList<>();
        if (clientId != null && !clientId.isEmpty()) {
            for (Seat s : seatsMap.values()) {
                if (s.state == SeatState.LOCKED && clientId.equals(s.lockedByClientId)) {
                    list.add(s.clone());
                }
            }
        }
        return list.toArray(new Seat[0]);
    }

    @Override
    public synchronized BookingRecord[] getMyBookings(String clientId, Current current) {
        List<BookingRecord> list = new ArrayList<>();
        if (clientId != null && !clientId.isEmpty()) {
            for (BookingRecord b : bookingsList) {
                if (clientId.equals(b.clientId)) {
                    list.add(b);
                }
            }
        }
        return list.toArray(new BookingRecord[0]);
    }

    @Override
    public synchronized void resetSeats(Current current) {
        initSeats();
        System.out.println("[RESET] Inventario y reservas reiniciadas a estado de fábrica.");
    }
}
