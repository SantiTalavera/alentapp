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
import { PostgresMedicalCertificateRepository } from './infrastructure/PostgresMedicalCertificateRepository.js';
import { CreateMedicalCertificateUseCase } from './application/medical-certificate/CreateMedicalCertificateUseCase.js';
import { UpdateMedicalCertificateUseCase } from './application/medical-certificate/UpdateMedicalCertificateUseCase.js';
import { DeleteMedicalCertificateUseCase } from './application/medical-certificate/DeleteMedicalCertificateUseCase.js';
import { GetMedicalCertificatesByMemberUseCase } from './application/medical-certificate/GetMedicalCertificatesByMemberUseCase.js';
import { GetMedicalCertificateByIdUseCase } from './application/medical-certificate/GetMedicalCertificateByIdUseCase.js';
import { MedicalCertificateController } from './delivery/MedicalCertificateController.js';
import { MedicalCertificateValidator } from './domain/services/MedicalCertificateValidator.js';

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

    const disciplineController = new DisciplineController(newDisciplineUseCase, updateDisciplineUseCase);


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

    server.get('/api/v1/socios', memberController.getAll.bind(memberController));
    server.post('/api/v1/socios', memberController.create.bind(memberController));
    server.put('/api/v1/socios/:id', memberController.update.bind(memberController));
    server.delete('/api/v1/socios/:id', memberController.delete.bind(memberController));
    server.post('/api/v1/disciplines', disciplineController.create.bind(disciplineController));
    server.get('/api/v1/sports', sportController.getAll.bind(sportController));
    server.get('/api/v1/sports/:id', sportController.getById.bind(sportController));
    server.patch('/api/v1/sports/:id', sportController.update.bind(sportController));
    server.delete('/api/v1/sports/:id', sportController.delete.bind(sportController));
    server.post('/api/v1/sports', sportController.create.bind(sportController));
    server.post('/api/v1/medical-certificates', medicalCertificateController.create.bind(medicalCertificateController));
    server.patch('/api/v1/disciplines/:id', disciplineController.update.bind(disciplineController));
    server.patch('/api/v1/medical-certificates/:id', medicalCertificateController.update.bind(medicalCertificateController));
    server.delete('/api/v1/medical-certificates/:id', medicalCertificateController.delete.bind(medicalCertificateController));
    server.get('/api/v1/members/:memberId/medical-certificates', medicalCertificateController.getByMemberId.bind(medicalCertificateController));
    server.get('/api/v1/medical-certificates/:id', medicalCertificateController.getById.bind(medicalCertificateController));



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