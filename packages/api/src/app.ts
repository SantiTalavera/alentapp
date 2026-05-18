import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PostgresMemberRepository } from './infrastructure/PostgresMemberRepository.js';
import { MemberValidator } from './domain/services/MemberValidator.js';
import { CreateMemberUseCase } from './application/NewMemberUseCase.js';
import { GetMembersUseCase } from './application/GetMembersUseCase.js';
import { UpdateMemberUseCase } from './application/UpdateMemberUseCase.js';
import { DeleteMemberUseCase } from './application/DeleteMemberUseCase.js';
import { MemberController } from './delivery/MemberController.js';
import { DisciplineController } from './delivery/DisciplineController.js';
import { NewDisciplineUseCase } from './application/discipline/NewDisciplineUseCase.js';
import { UpdateDisciplineUseCase } from './application/discipline/UpdateDisciplineUseCase.js';
import { GetDisciplineByIdUseCase } from './application/discipline/GetDisciplineByIdUseCase.js';
import { GetDisciplineByMemberIdUseCase } from './application/discipline/GetDisciplineByMemberIdUseCase.js';
import { DisciplineValidator } from './domain/services/DisciplineValidator.js';
import { PostgresDisciplineRepository } from './infrastructure/PostgresDisciplineRepository.js';
import { PostgresSportRepository } from './infrastructure/PostgresSportRepository.js';
import { SportValidator } from './domain/services/SportValidator.js';
import { NewSportUseCase } from './application/sport/NewSportUseCase.js';
import { GetSportsUseCase } from './application/sport/GetSportsUseCase.js';
import { GetSportByIdUseCase } from './application/sport/GetSportByIdUseCase.js';
import { UpdateSportUseCase } from './application/sport/UpdateSportUseCase.js';
import { DeleteSportUseCase } from './application/sport/DeleteSportUseCase.js';
import { SportController } from './delivery/SportController.js';
import { PostgresLockerRepository } from './infrastructure/PostgresLockerRepository.js';
import { LockerValidator } from './domain/services/LockerValidator.js';
import { NewLockerUseCase } from './application/locker/NewLockerUseCase.js';
import { UpdateLockerUseCase } from './application/locker/UpdateLockerUseCase.js';
import { DeleteLockerUseCase } from './application/locker/DeleteLockerUseCase.js';
import { GetLockersUseCase } from './application/locker/GetLockersUseCase.js';
import { GetLockerByIdUseCase } from './application/locker/GetLockerByIdUseCase.js';
import { LockerController } from './delivery/LockerController.js';
import { PostgresMedicalCertificateRepository } from './infrastructure/PostgresMedicalCertificateRepository.js';
import { CreateMedicalCertificateUseCase } from './application/medical-certificate/CreateMedicalCertificateUseCase.js';
import { UpdateMedicalCertificateUseCase } from './application/medical-certificate/UpdateMedicalCertificateUseCase.js';
import { DeleteMedicalCertificateUseCase } from './application/medical-certificate/DeleteMedicalCertificateUseCase.js';
import { GetMedicalCertificatesByMemberUseCase } from './application/medical-certificate/GetMedicalCertificatesByMemberUseCase.js';
import { GetMedicalCertificateByIdUseCase } from './application/medical-certificate/GetMedicalCertificateByIdUseCase.js';
import { MedicalCertificateController } from './delivery/MedicalCertificateController.js';
import { MedicalCertificateValidator } from './domain/services/MedicalCertificateValidator.js';
import { PostgresPaymentRepository } from './infrastructure/PostgresPaymentRepository.js';
import { CreatePaymentUseCase } from './application/payment/CreatePaymentUseCase.js';
import { GetPaymentsUseCase } from './application/payment/GetPaymentsUseCase.js';
import { GetPaymentByIdUseCase } from './application/payment/GetPaymentByIdUseCase.js';
import { UpdatePaymentUseCase } from './application/payment/UpdatePaymentUseCase.js';
import { CancelPaymentUseCase } from './application/payment/CancelPaymentUseCase.js';
import { PaymentController } from './delivery/PaymentController.js';
import { PostgresEnrollmentRepository } from './infrastructure/PostgresEnrollmentRepository.js';
import { EnrollmentValidator } from './domain/services/EnrollmentValidator.js';
import { CreateEnrollmentUseCase } from './application/enrollment/CreateEnrollmentUseCase.js';
import { UpdateEnrollmentUseCase } from './application/enrollment/UpdateEnrollmentUseCase.js';
import { GetEnrollmentsUseCase } from './application/enrollment/GetEnrollmentsUseCase.js';
import { GetEnrollmentByIdUseCase } from './application/enrollment/GetEnrollmentByIdUseCase.js';
import { DeleteEnrollmentUseCase } from './application/enrollment/DeleteEnrollmentUseCase.js';
import { EnrollmentController } from './delivery/EnrollmentController.js';
import { PostgresEquipmentLoanRepository } from './infrastructure/PostgresEquipmentLoanRepository.js';
import { EquipmentLoanValidator } from './domain/services/EquipmentLoanValidator.js';
import { CreateEquipmentLoanUseCase } from './application/loan/CreateEquipmentLoanUseCase.js';
import { GetEquipmentLoansUseCase } from './application/loan/GetEquipmentLoansUseCase.js';
import { GetEquipmentLoanByIdUseCase } from './application/loan/GetEquipmentLoanByIdUseCase.js';
import { UpdateEquipmentLoanUseCase } from './application/loan/UpdateEquipmentLoanUseCase.js';
import { DeleteEquipmentLoanUseCase } from './application/loan/DeleteEquipmentLoanUseCase.js';
import { EquipmentLoanController } from './delivery/EquipmentLoanController.js';

export function buildApp() {
    const server = Fastify({
        logger: {
            level: 'info',
            transport: process.env.NODE_ENV === 'development'
                ? {
                    target: 'pino-pretty',
                    options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
                }
                : undefined,
        },
    });

    server.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    const memberRepo = new PostgresMemberRepository();
    const memberValidator = new MemberValidator(memberRepo);

    const createMemberUseCase = new CreateMemberUseCase(memberRepo, memberValidator);
    const getMembersUseCase = new GetMembersUseCase(memberRepo);
    const updateMemberUseCase = new UpdateMemberUseCase(memberRepo, memberValidator);
    const deleteMemberUseCase = new DeleteMemberUseCase(memberRepo);

    const memberController = new MemberController(
        createMemberUseCase,
        getMembersUseCase,
        updateMemberUseCase,
        deleteMemberUseCase
    );

    const disciplineRepository = new PostgresDisciplineRepository();
    const disciplineValidator = new DisciplineValidator();
    const newDisciplineUseCase = new NewDisciplineUseCase(
        disciplineRepository,
        memberRepo,
        disciplineValidator
    );
    const updateDisciplineUseCase = new UpdateDisciplineUseCase(
        disciplineRepository,
        memberRepo,
        disciplineValidator
    );
    const getDisciplineByIdUseCase = new GetDisciplineByIdUseCase(
        disciplineRepository
    );
    const getDisciplineByMemberIdUseCase = new GetDisciplineByMemberIdUseCase(
        disciplineRepository,
        memberRepo
    );

    const disciplineController = new DisciplineController(
        newDisciplineUseCase,
        updateDisciplineUseCase,
        getDisciplineByIdUseCase,
        getDisciplineByMemberIdUseCase
    );


    const sportRepository = new PostgresSportRepository();
    const sportValidator = new SportValidator();
    const newSportUseCase = new NewSportUseCase(sportRepository, sportValidator);
    const getSportsUseCase = new GetSportsUseCase(sportRepository);
    const getSportByIdUseCase = new GetSportByIdUseCase(sportRepository);
    const updateSportUseCase = new UpdateSportUseCase(sportRepository, sportValidator);
    const deleteSportUseCase = new DeleteSportUseCase(sportRepository);
    const sportController = new SportController(
        newSportUseCase,
        getSportsUseCase,
        getSportByIdUseCase,
        updateSportUseCase,
        deleteSportUseCase,
    );

    const lockerRepository = new PostgresLockerRepository();
    const lockerValidator = new LockerValidator();
    const newLockerUseCase = new NewLockerUseCase(lockerRepository, lockerValidator);
    const updateLockerUseCase = new UpdateLockerUseCase(lockerRepository, lockerValidator);
    const deleteLockerUseCase = new DeleteLockerUseCase(lockerRepository);
    const getLockersUseCase = new GetLockersUseCase(lockerRepository);
    const getLockerByIdUseCase = new GetLockerByIdUseCase(lockerRepository);
    const lockerController = new LockerController(newLockerUseCase, updateLockerUseCase, deleteLockerUseCase, getLockersUseCase, getLockerByIdUseCase);

    const medicalCertificateRepository = new PostgresMedicalCertificateRepository();
    const medicalCertificateValidator = new MedicalCertificateValidator();
    const createMedicalCertificateUseCase = new CreateMedicalCertificateUseCase(
        medicalCertificateRepository,
        memberRepo,
        medicalCertificateValidator
    );
    const updateMedicalCertificateUseCase = new UpdateMedicalCertificateUseCase(
        medicalCertificateRepository,
        medicalCertificateValidator
    );
    const deleteMedicalCertificateUseCase = new DeleteMedicalCertificateUseCase(
        medicalCertificateRepository
    );
    const getMedicalCertificatesByMemberUseCase = new GetMedicalCertificatesByMemberUseCase(
        medicalCertificateRepository
    );
    const getMedicalCertificateByIdUseCase = new GetMedicalCertificateByIdUseCase(
        medicalCertificateRepository
    );
    const medicalCertificateController = new MedicalCertificateController(
        createMedicalCertificateUseCase,
        updateMedicalCertificateUseCase,
        deleteMedicalCertificateUseCase,
        getMedicalCertificatesByMemberUseCase,
        getMedicalCertificateByIdUseCase
    );

    const paymentRepository = new PostgresPaymentRepository();
    const createPaymentUseCase = new CreatePaymentUseCase(
        paymentRepository,
        memberRepo
    );
    const getPaymentsUseCase = new GetPaymentsUseCase(paymentRepository);
    const getPaymentByIdUseCase = new GetPaymentByIdUseCase(paymentRepository);
    const updatePaymentUseCase = new UpdatePaymentUseCase(paymentRepository);
    const cancelPaymentUseCase = new CancelPaymentUseCase(paymentRepository);
    const paymentController = new PaymentController(
        createPaymentUseCase,
        getPaymentsUseCase,
        getPaymentByIdUseCase,
        updatePaymentUseCase,
        cancelPaymentUseCase
    );

    const enrollmentRepository = new PostgresEnrollmentRepository();
    const enrollmentValidator = new EnrollmentValidator(
        enrollmentRepository,
        memberRepo,
        sportRepository
    );
    const createEnrollmentUseCase = new CreateEnrollmentUseCase(
        enrollmentRepository,
        enrollmentValidator
    );
    const updateEnrollmentUseCase = new UpdateEnrollmentUseCase(
        enrollmentRepository,
        enrollmentValidator
    );
    const getEnrollmentsUseCase = new GetEnrollmentsUseCase(enrollmentRepository);
    const getEnrollmentByIdUseCase = new GetEnrollmentByIdUseCase(
        enrollmentRepository
    );
    const deleteEnrollmentUseCase = new DeleteEnrollmentUseCase(
        enrollmentRepository
    );
    const enrollmentController = new EnrollmentController(
        createEnrollmentUseCase,
        updateEnrollmentUseCase,
        getEnrollmentsUseCase,
        getEnrollmentByIdUseCase,
        deleteEnrollmentUseCase
    );

    const equipmentLoanRepository = new PostgresEquipmentLoanRepository();
    const equipmentLoanValidator = new EquipmentLoanValidator(memberRepo);
    const createEquipmentLoanUseCase = new CreateEquipmentLoanUseCase(
        equipmentLoanRepository,
        equipmentLoanValidator
    );
    const getEquipmentLoansUseCase = new GetEquipmentLoansUseCase(
        equipmentLoanRepository,
        equipmentLoanValidator
    );
    const getEquipmentLoanByIdUseCase = new GetEquipmentLoanByIdUseCase(
        equipmentLoanRepository,
        equipmentLoanValidator
    );
    const updateEquipmentLoanUseCase = new UpdateEquipmentLoanUseCase(
        equipmentLoanRepository,
        equipmentLoanValidator
    );
    const deleteEquipmentLoanUseCase = new DeleteEquipmentLoanUseCase(
        equipmentLoanRepository
    );
    const equipmentLoanController = new EquipmentLoanController(
        createEquipmentLoanUseCase,
        getEquipmentLoansUseCase,
        getEquipmentLoanByIdUseCase,
        updateEquipmentLoanUseCase,
        deleteEquipmentLoanUseCase
    );

    server.get('/api/v1/socios', memberController.getAll.bind(memberController));
    server.post('/api/v1/socios', memberController.create.bind(memberController));
    server.put('/api/v1/socios/:id', memberController.update.bind(memberController));
    server.delete('/api/v1/socios/:id', memberController.delete.bind(memberController));
    server.post('/api/v1/disciplines', disciplineController.create.bind(disciplineController));
    server.get('/api/v1/members/:memberId/disciplines', disciplineController.getByMemberId.bind(disciplineController));
    server.get('/api/v1/disciplines/:id', disciplineController.getById.bind(disciplineController));
    server.get('/api/v1/sports', sportController.getAll.bind(sportController));
    server.get('/api/v1/sports/:id', sportController.getById.bind(sportController));
    server.patch('/api/v1/sports/:id', sportController.update.bind(sportController));
    server.delete('/api/v1/sports/:id', sportController.delete.bind(sportController));
    server.post('/api/v1/sports', sportController.create.bind(sportController));
    server.post('/api/v1/lockers', lockerController.create.bind(lockerController));
    server.patch('/api/v1/lockers/:id', lockerController.update.bind(lockerController));
    server.delete('/api/v1/lockers/:id', lockerController.delete.bind(lockerController));
    server.get('/api/v1/lockers', lockerController.getAll.bind(lockerController));
    server.get('/api/v1/lockers/:id', lockerController.getById.bind(lockerController));
    server.post('/api/v1/medical-certificates', medicalCertificateController.create.bind(medicalCertificateController));
    server.patch('/api/v1/disciplines/:id', disciplineController.update.bind(disciplineController));
    server.patch('/api/v1/medical-certificates/:id', medicalCertificateController.update.bind(medicalCertificateController));
    server.delete('/api/v1/medical-certificates/:id', medicalCertificateController.delete.bind(medicalCertificateController));
    server.get('/api/v1/members/:memberId/medical-certificates', medicalCertificateController.getByMemberId.bind(medicalCertificateController));
    server.get('/api/v1/medical-certificates/:id', medicalCertificateController.getById.bind(medicalCertificateController));
    server.post('/api/v1/payments', paymentController.create.bind(paymentController));
    server.post(
        '/api/v1/enrollments',
        enrollmentController.create.bind(enrollmentController)
    );
    server.patch(
        '/api/v1/enrollments/:id',
        enrollmentController.update.bind(enrollmentController)
    );
    server.get(
        '/api/v1/enrollments',
        enrollmentController.getAll.bind(enrollmentController)
    );
    server.get(
        '/api/v1/enrollments/:id',
        enrollmentController.getById.bind(enrollmentController)
    );
    server.delete(
        '/api/v1/enrollments/:id',
        enrollmentController.delete.bind(enrollmentController)
    );
    server.get('/api/v1/payments', paymentController.getAll.bind(paymentController));
    server.get('/api/v1/payments/:id', paymentController.getById.bind(paymentController));
    server.patch('/api/v1/payments/:id', paymentController.update.bind(paymentController));
    server.post('/api/v1/loans', equipmentLoanController.create.bind(equipmentLoanController));
    server.get('/api/v1/loans', equipmentLoanController.getAll.bind(equipmentLoanController));
    server.get('/api/v1/loans/:id', equipmentLoanController.getById.bind(equipmentLoanController));
    server.patch('/api/v1/loans/:id', equipmentLoanController.update.bind(equipmentLoanController));
    server.delete('/api/v1/loans/:id', equipmentLoanController.delete.bind(equipmentLoanController));
    server.delete('/api/v1/payments/:id', paymentController.delete.bind(paymentController));



    server.get('/', async (req, rep) => {
        rep.status(200).send({ msg: 'asd' })
    });

    return server;
}

// Solo iniciar el servidor si el script se ejecuta directamente (no cuando es importado por vitest)
if (process.argv[1] && process.argv[1].endsWith('app.ts')) {
    const server = buildApp();
    const port = parseInt(process.env.PORT || '3000', 10);

    server.listen({ port, host: '0.0.0.0' }, () =>
        server.log.info(`API server running on http://localhost:${port}`)
    );

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
        process.on(signal, async () => {
            await server.close();
            process.exit(0);
        });
    });
}
