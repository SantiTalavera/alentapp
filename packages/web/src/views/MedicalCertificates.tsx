import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Table,
  Text,
  IconButton
} from '@chakra-ui/react';
import { LuRefreshCw, LuSearch, LuTrash2, LuX, LuPencil } from 'react-icons/lu';
import type { MedicalCertificateDTO, MemberDTO, CreateMedicalCertificateRequest } from '@alentapp/shared';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
  DialogCloseTrigger
} from "../components/ui/dialog";
import { Field } from "../components/ui/field";
import { medicalCertificatesService } from '../services/medicalCertificates';
import { membersService } from '../services/members';

function getCertStatus(cert: MedicalCertificateDTO): {
  label: string;
  bg: string;
  color: string;
} {
  const now = new Date();
  const expiryDate = new Date(cert.expiry_date);

  if (!cert.is_validated) {
    return { label: 'Invalidado', bg: 'red.50', color: 'red.700' };
  }

  if (expiryDate < now) {
    return { label: 'Vencido', bg: 'gray.50', color: 'gray.700' };
  }

  return { label: 'Activo', bg: 'green.50', color: 'green.700' };
}

function formatDate(value: string): string {
  // Add a fake time to ensure it parses as local date correctly across timezones
  return new Date(value + 'T12:00:00Z').toLocaleDateString();
}

export function MedicalCertificatesView() {
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [certs, setCerts] = useState<MedicalCertificateDTO[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isCertsLoading, setIsCertsLoading] = useState(false);
  const [deletingCertId, setDeletingCertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState<CreateMedicalCertificateRequest>({
    member_id: "",
    issue_date: "",
    expiry_date: "",
    doctor_license: "",
  });

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.dni.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const loadMembers = async () => {
    setIsMembersLoading(true);
    setError(null);

    try {
      const data = await membersService.getAll();
      setMembers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar los socios';
      setError(message);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const loadCerts = async (member: MemberDTO) => {
    setIsCertsLoading(true);
    setError(null);

    try {
      const data = await medicalCertificatesService.getByMemberId(member.id);
      setCerts(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar los certificados';
      setError(message);
    } finally {
      setIsCertsLoading(false);
    }
  };

  const handleSelectMember = async (member: MemberDTO) => {
    setSelectedMember(member);
    setSearchQuery('');
    setCerts([]);
    setSuccessMessage(null);
    await loadCerts(member);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setCerts([]);
    setSearchQuery('');
    setSuccessMessage(null);
    setError(null);
  };

  const handleRefresh = async () => {
    setSuccessMessage(null);

    if (selectedMember) {
      await loadCerts(selectedMember);
      return;
    }

    await loadMembers();
  };

  const handleDelete = async (cert: MedicalCertificateDTO) => {
    const confirmed = window.confirm(
      `¿Confirmás la eliminación del certificado médico? Esta acción no se puede deshacer.`
    );

    if (!confirmed || !selectedMember) {
      return;
    }

    setDeletingCertId(cert.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await medicalCertificatesService.delete(cert.id);
      setSuccessMessage('Certificado eliminado correctamente.');
      await loadCerts(selectedMember);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el certificado.';
      setError(message);
    } finally {
      setDeletingCertId(null);
    }
  };

  const handleOpenEdit = (cert: MedicalCertificateDTO) => {
    setEditingCertId(cert.id);
    setEditFormData({
      member_id: cert.member_id,
      issue_date: cert.issue_date.split('T')[0],
      expiry_date: cert.expiry_date.split('T')[0],
      doctor_license: cert.doctor_license,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCertId || !selectedMember) return;
    
    setIsSubmittingEdit(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await medicalCertificatesService.update(editingCertId, editFormData);
      setSuccessMessage('Certificado actualizado correctamente.');
      setIsEditDialogOpen(false);
      await loadCerts(selectedMember);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el certificado.';
      setError(message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  return (
    <Stack gap="8">
      <Flex justify="space-between" align="center" wrap="wrap" gap="4">
        <Stack gap="1">
          <Heading size="2xl" fontWeight="bold">
            Administración de Certificados
          </Heading>
          <Text color="fg.muted" fontSize="md">
            Consultá el historial de aptos médicos de un socio y eliminá certificados cargados por error.
          </Text>
        </Stack>
        <Button
          variant="outline"
          onClick={() => void handleRefresh()}
          loading={isMembersLoading || isCertsLoading}
        >
          <LuRefreshCw /> Actualizar
        </Button>
      </Flex>

      {successMessage ? (
        <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="md" p="4">
          <Text color="green.700" fontWeight="medium">
            {successMessage}
          </Text>
        </Box>
      ) : null}

      {error ? (
        <Box bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md" p="4">
          <Text color="red.700" fontWeight="medium">
            {error}
          </Text>
        </Box>
      ) : null}

      <Flex gap="8" align="flex-start" wrap={{ base: 'wrap', lg: 'nowrap' }}>
        <Box flex="1" minW={{ base: '100%', lg: '340px' }} maxW={{ lg: '380px' }}>
          <Stack gap="4">
            <Stack gap="1">
              <Text fontWeight="semibold" fontSize="sm" color="fg.muted" textTransform="uppercase">
                Socio
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Buscá por nombre o DNI para consultar sus certificados.
              </Text>
            </Stack>

            {selectedMember ? (
              <Box bg="blue.50" borderRadius="lg" p="4" borderWidth="1px" borderColor="blue.200">
                <Flex justify="space-between" align="flex-start" gap="3">
                  <Stack gap="1">
                    <Text fontWeight="bold" color="blue.800">
                      {selectedMember.name}
                    </Text>
                    <Text fontSize="sm" color="blue.700">
                      DNI {selectedMember.dni}
                    </Text>
                    <HStack gap="2">
                      <Box px="2" py="0.5" borderRadius="md" bg="blue.100" color="blue.800" fontSize="xs" fontWeight="bold">
                        {selectedMember.category}
                      </Box>
                      <Box px="2" py="0.5" borderRadius="md" bg="gray.100" color="gray.800" fontSize="xs" fontWeight="bold">
                        {selectedMember.status}
                      </Box>
                    </HStack>
                  </Stack>
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={handleClearMember}>
                    <LuX /> Cambiar
                  </Button>
                </Flex>
              </Box>
            ) : (
              <Stack gap="3">
                <Box position="relative">
                  <Input
                    placeholder="Buscar socio..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    pl="10"
                  />
                  <Box
                    position="absolute"
                    left="3"
                    top="50%"
                    transform="translateY(-50%)"
                    color="fg.muted"
                    pointerEvents="none"
                  >
                    <LuSearch size={16} />
                  </Box>
                </Box>

                {isMembersLoading ? (
                  <Center py="8">
                    <Spinner />
                  </Center>
                ) : filteredMembers.length === 0 ? (
                  <Box p="4" bg="bg.muted" borderRadius="lg">
                    <Text color="fg.muted" fontSize="sm">
                      No se encontraron socios.
                    </Text>
                  </Box>
                ) : (
                  <Stack gap="2" maxH="420px" overflowY="auto" pr="1">
                    {filteredMembers.map((member) => (
                      <Box
                        key={member.id}
                        as="button"
                        textAlign="left"
                        p="3"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        _hover={{ bg: 'bg.muted' }}
                        onClick={() => void handleSelectMember(member)}
                      >
                        <Text fontWeight="semibold">{member.name}</Text>
                        <Text fontSize="sm" color="fg.muted">
                          DNI {member.dni}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </Box>

        <Box flex="2" minW={{ base: '100%', lg: '0' }} bg="bg.panel" borderRadius="lg" borderWidth="1px" overflow="hidden">
          {selectedMember === null ? (
            <Center minH="360px">
              <Text color="fg.muted">Seleccioná un socio para ver sus certificados.</Text>
            </Center>
          ) : isCertsLoading ? (
            <Center minH="360px">
              <Stack align="center" gap="4">
                <Spinner size="xl" />
                <Text color="fg.muted">Cargando certificados...</Text>
              </Stack>
            </Center>
          ) : certs.length === 0 ? (
            <Center minH="360px">
              <Text color="fg.muted">El socio no tiene certificados registrados.</Text>
            </Center>
          ) : (
            <Table.Root size="md" variant="line" interactive>
              <Table.Header>
                <Table.Row bg="bg.muted/50">
                  <Table.ColumnHeader>Matrícula</Table.ColumnHeader>
                  <Table.ColumnHeader>Emisión</Table.ColumnHeader>
                  <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
                  <Table.ColumnHeader>Estado</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {certs.map((cert) => {
                  const status = getCertStatus(cert);

                  return (
                    <Table.Row key={cert.id}>
                      <Table.Cell>
                        <Text fontWeight="medium">
                          {cert.doctor_license}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>{formatDate(cert.issue_date)}</Table.Cell>
                      <Table.Cell>{formatDate(cert.expiry_date)}</Table.Cell>
                      <Table.Cell>
                        <Box
                          display="inline-block"
                          px="2"
                          py="0.5"
                          borderRadius="md"
                          bg={status.bg}
                          color={status.color}
                          fontSize="xs"
                          fontWeight="bold"
                        >
                          {status.label}
                        </Box>
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        <HStack justify="flex-end" gap={2}>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(cert)}
                            disabled={deletingCertId !== null}
                          >
                            <LuPencil />
                          </IconButton>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => void handleDelete(cert)}
                            loading={deletingCertId === cert.id}
                            disabled={deletingCertId !== null && deletingCertId !== cert.id}
                          >
                            <LuTrash2 /> Eliminar
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Flex>

      <DialogRoot open={isEditDialogOpen} onOpenChange={(e) => setIsEditDialogOpen(e.open)}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>
                Actualizar Certificado Médico
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                <Field label="Fecha de Emisión" required>
                  <Input
                    type="date"
                    value={editFormData.issue_date}
                    onChange={(e) => setEditFormData({ ...editFormData, issue_date: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Fecha de Vencimiento" required>
                  <Input
                    type="date"
                    value={editFormData.expiry_date}
                    onChange={(e) => setEditFormData({ ...editFormData, expiry_date: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Matrícula del Médico" required>
                  <Input
                    placeholder="Ej: MN 12345"
                    value={editFormData.doctor_license}
                    onChange={(e) => setEditFormData({ ...editFormData, doctor_license: e.target.value })}
                    required
                  />
                </Field>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button type="submit" colorPalette="blue" loading={isSubmittingEdit}>
                Actualizar Certificado
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>
      </DialogRoot>
    </Stack>
  );
}
