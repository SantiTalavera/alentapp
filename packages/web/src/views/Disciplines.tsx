import { type FormEvent, useEffect, useMemo, useState } from 'react';
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
  Textarea,
} from '@chakra-ui/react';
import { LuPencil, LuRefreshCw, LuSearch, LuTrash2, LuX } from 'react-icons/lu';
import type { DisciplineDTO, MemberDTO, UpdateDisciplineRequest } from '@alentapp/shared';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/ui/dialog';
import { Field } from '../components/ui/field';
import { disciplinesService } from '../services/disciplines';
import { membersService } from '../services/members';

function getDisciplineStatus(discipline: DisciplineDTO): {
  label: string;
  bg: string;
  color: string;
} {
  const now = new Date();
  const startDate = new Date(discipline.start_date);
  const endDate = new Date(discipline.end_date);

  if (startDate > now) {
    return { label: 'Futura', bg: 'blue.50', color: 'blue.700' };
  }

  if (endDate < now) {
    return { label: 'Vencida', bg: 'gray.50', color: 'gray.700' };
  }

  return { label: 'Activa', bg: 'green.50', color: 'green.700' };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

const initialEditFormState = (): UpdateDisciplineRequest => ({
  reason: '',
  start_date: '',
  end_date: '',
  is_total_suspension: false,
});

export function DisciplinesView() {
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplines, setDisciplines] = useState<DisciplineDTO[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isDisciplinesLoading, setIsDisciplinesLoading] = useState(false);
  const [deletingDisciplineId, setDeletingDisciplineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplineDTO | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDisciplineRequest>(initialEditFormState());
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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

  const loadDisciplines = async (member: MemberDTO) => {
    setIsDisciplinesLoading(true);
    setError(null);

    try {
      const data = await disciplinesService.getByMemberId(member.id);
      setDisciplines(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar las sanciones';
      setError(message);
    } finally {
      setIsDisciplinesLoading(false);
    }
  };

  const handleSelectMember = async (member: MemberDTO) => {
    setSelectedMember(member);
    setSearchQuery('');
    setDisciplines([]);
    setSuccessMessage(null);
    await loadDisciplines(member);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setDisciplines([]);
    setSearchQuery('');
    setSuccessMessage(null);
    setError(null);
  };

  const handleRefresh = async () => {
    setSuccessMessage(null);

    if (selectedMember) {
      await loadDisciplines(selectedMember);
      return;
    }

    await loadMembers();
  };

  const openEditModal = (discipline: DisciplineDTO) => {
    setEditingDiscipline(discipline);
    setEditFormData({
      reason: discipline.reason,
      start_date: toDateTimeLocalValue(discipline.start_date),
      end_date: toDateTimeLocalValue(discipline.end_date),
      is_total_suspension: discipline.is_total_suspension,
    });
    setEditFormError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingDiscipline || !selectedMember) {
      return;
    }

    setIsEditSubmitting(true);
    setEditFormError(null);
    setSuccessMessage(null);

    try {
      await disciplinesService.update(editingDiscipline.id, {
        reason: editFormData.reason,
        start_date: editFormData.start_date,
        end_date: editFormData.end_date,
        is_total_suspension: editFormData.is_total_suspension,
      });
      setSuccessMessage('Sanción actualizada correctamente.');
      setIsEditOpen(false);
      setEditingDiscipline(null);
      setEditFormData(initialEditFormState());
      await loadDisciplines(selectedMember);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la sanción.';
      setEditFormError(message);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (discipline: DisciplineDTO) => {
    const status = getDisciplineStatus(discipline);
    const warning =
      discipline.is_total_suspension && status.label === 'Activa'
        ? ' Esta sanción es una suspensión total activa; al eliminarla puede restaurarse el estado anterior del socio si no quedan otras suspensiones totales vigentes.'
        : '';

    const confirmed = window.confirm(
      `¿Confirmás la eliminación de la sanción "${discipline.reason}"? Esta acción no se puede deshacer.${warning}`
    );

    if (!confirmed || !selectedMember) {
      return;
    }

    setDeletingDisciplineId(discipline.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await disciplinesService.delete(discipline.id);
      setSuccessMessage('Sanción eliminada correctamente.');
      await loadDisciplines(selectedMember);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la sanción.';
      setError(message);
    } finally {
      setDeletingDisciplineId(null);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  return (
    <>
      <DialogRoot
        open={isEditOpen}
        onOpenChange={(event) => {
          setIsEditOpen(event.open);
          if (!event.open) {
            setEditingDiscipline(null);
            setEditFormData(initialEditFormState());
            setEditFormError(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar sanción</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                {editFormError ? (
                  <Text color="red.600" fontWeight="medium">
                    {editFormError}
                  </Text>
                ) : null}

                <Field label="Socio">
                  <Input value={selectedMember ? `${selectedMember.name} - DNI ${selectedMember.dni}` : ''} readOnly />
                </Field>

                <Field label="Motivo" required>
                  <Textarea
                    value={editFormData.reason ?? ''}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, reason: event.target.value })
                    }
                    rows={4}
                  />
                </Field>

                <Field label="Fecha de inicio" required>
                  <Input
                    type="datetime-local"
                    value={editFormData.start_date ?? ''}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, start_date: event.target.value })
                    }
                  />
                </Field>

                <Field label="Fecha de fin" required>
                  <Input
                    type="datetime-local"
                    value={editFormData.end_date ?? ''}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, end_date: event.target.value })
                    }
                  />
                </Field>

                <Field label="Suspensión total">
                  <input
                    type="checkbox"
                    checked={editFormData.is_total_suspension ?? false}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        is_total_suspension: event.target.checked,
                      })
                    }
                  />
                </Field>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button type="submit" colorPalette="blue" loading={isEditSubmitting}>
                Guardar cambios
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>
      </DialogRoot>

      <Stack gap="8">
      <Flex justify="space-between" align="center" wrap="wrap" gap="4">
        <Stack gap="1">
          <Heading size="2xl" fontWeight="bold">
            Administración de Sanciones
          </Heading>
          <Text color="fg.muted" fontSize="md">
            Consultá el historial disciplinario de un socio y eliminá sanciones cargadas por error.
          </Text>
        </Stack>
        <Button
          variant="outline"
          onClick={() => void handleRefresh()}
          loading={isMembersLoading || isDisciplinesLoading}
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
                Buscá por nombre o DNI para consultar su historial.
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
              <Text color="fg.muted">Seleccioná un socio para ver sus sanciones.</Text>
            </Center>
          ) : isDisciplinesLoading ? (
            <Center minH="360px">
              <Stack align="center" gap="4">
                <Spinner size="xl" />
                <Text color="fg.muted">Cargando sanciones...</Text>
              </Stack>
            </Center>
          ) : disciplines.length === 0 ? (
            <Center minH="360px">
              <Text color="fg.muted">El socio no tiene sanciones registradas.</Text>
            </Center>
          ) : (
            <Table.Root size="md" variant="line" interactive>
              <Table.Header>
                <Table.Row bg="bg.muted/50">
                  <Table.ColumnHeader>Motivo</Table.ColumnHeader>
                  <Table.ColumnHeader>Inicio</Table.ColumnHeader>
                  <Table.ColumnHeader>Fin</Table.ColumnHeader>
                  <Table.ColumnHeader>Alcance</Table.ColumnHeader>
                  <Table.ColumnHeader>Estado</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {disciplines.map((discipline) => {
                  const status = getDisciplineStatus(discipline);

                  return (
                    <Table.Row key={discipline.id}>
                      <Table.Cell maxW="xs">
                        <Text fontWeight="medium" lineClamp={2}>
                          {discipline.reason}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>{formatDate(discipline.start_date)}</Table.Cell>
                      <Table.Cell>{formatDate(discipline.end_date)}</Table.Cell>
                      <Table.Cell>
                        <Box
                          display="inline-block"
                          px="2"
                          py="0.5"
                          borderRadius="md"
                          bg={discipline.is_total_suspension ? 'red.50' : 'gray.50'}
                          color={discipline.is_total_suspension ? 'red.700' : 'gray.700'}
                          fontSize="xs"
                          fontWeight="bold"
                        >
                          {discipline.is_total_suspension ? 'Total' : 'Parcial'}
                        </Box>
                      </Table.Cell>
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
                        <HStack gap="1" justify="flex-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(discipline)}
                            disabled={deletingDisciplineId !== null}
                          >
                            <LuPencil /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => void handleDelete(discipline)}
                            loading={deletingDisciplineId === discipline.id}
                            disabled={deletingDisciplineId !== null && deletingDisciplineId !== discipline.id}
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
      </Stack>
    </>
  );
}
