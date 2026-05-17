import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  IconButton,
  SelectPositioner,
  Spinner,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { LuBan, LuCheck, LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import type { EnrollmentDTO, MemberDTO, SportDTO } from '@alentapp/shared';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
  DialogCloseTrigger,
} from '../components/ui/dialog';
import { Field } from '../components/ui/field';
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  createListCollection,
} from '../components/ui/select';
import {
  enrollmentsService,
  type EnrollmentListFilters,
} from '../services/enrollments';
import { membersService } from '../services/members';
import { sportsService } from '../services/sports';

type VigenciaFilter = 'all' | 'active' | 'inactive';

const vigenciaCollection = createListCollection({
  items: [
    { label: 'Todas', value: 'all' as const },
    { label: 'Vigentes', value: 'active' as const },
    { label: 'Históricas / inactivas', value: 'inactive' as const },
  ],
});

function formatEnrollmentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      dateStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export function EnrollmentsView() {
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [sports, setSports] = useState<SportDTO[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDTO[]>([]);

  const [catalogsLoaded, setCatalogsLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterSportId, setFilterSportId] = useState('');
  const [vigenciaFilter, setVigenciaFilter] =
    useState<VigenciaFilter>('all');

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formMemberId, setFormMemberId] = useState('');
  const [formSportId, setFormSportId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [updatingEnrollmentId, setUpdatingEnrollmentId] = useState<
    string | null
  >(null);

  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<
    string | null
  >(null);

  const filterMemberCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: 'Todos los socios', value: '__all_members__' },
          ...members.map((m) => ({
            label: `${m.name} — DNI ${m.dni}`,
            value: m.id,
          })),
        ],
      }),
    [members],
  );

  const filterSportCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: 'Todos los deportes', value: '__all_sports__' },
          ...sports.map((s) => ({
            label: `${s.name} (cupo máx. ${s.max_capacity})`,
            value: s.id,
          })),
        ],
      }),
    [sports],
  );

  const modalMemberCollection = useMemo(
    () =>
      createListCollection({
        items: members.map((m) => ({
          label: `${m.name} — DNI ${m.dni}`,
          value: m.id,
        })),
      }),
    [members],
  );

  const modalSportCollection = useMemo(
    () =>
      createListCollection({
        items: sports.map((s) => ({
          label: `${s.name} (cupo máx. ${s.max_capacity})`,
          value: s.id,
        })),
      }),
    [sports],
  );

  const buildApiFilters = useCallback((): EnrollmentListFilters => {
    const f: EnrollmentListFilters = {};
    if (filterMemberId) {
      f.memberId = filterMemberId;
    }
    if (filterSportId) {
      f.sportId = filterSportId;
    }
    if (vigenciaFilter === 'active') {
      f.isActive = true;
    }
    if (vigenciaFilter === 'inactive') {
      f.isActive = false;
    }
    return f;
  }, [filterMemberId, filterSportId, vigenciaFilter]);

  const loadCatalogs = useCallback(async () => {
    setCatalogError(null);
    try {
      const [membersData, sportsData] = await Promise.all([
        membersService.getAll(),
        sportsService.getAll(),
      ]);
      setMembers(membersData);
      setSports(sportsData);
      setCatalogsLoaded(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar socios y deportes';
      setCatalogError(message);
      setMembers([]);
      setSports([]);
      setCatalogsLoaded(true);
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await enrollmentsService.getAll(buildApiFilters());
      setEnrollments(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al cargar las inscripciones';
      setListError(message);
      setEnrollments([]);
    } finally {
      setListLoading(false);
    }
  }, [buildApiFilters]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    if (!catalogsLoaded) {
      return;
    }
    void loadEnrollments();
  }, [catalogsLoaded, loadEnrollments]);

  const openCreateModal = () => {
    setFormMemberId('');
    setFormSportId('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleRefresh = useCallback(async () => {
    setSuccessMessage(null);
    setListLoading(true);
    setCatalogError(null);
    setListError(null);
    try {
      const [membersData, sportsData] = await Promise.all([
        membersService.getAll(),
        sportsService.getAll(),
      ]);
      setMembers(membersData);
      setSports(sportsData);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar socios y deportes';
      setCatalogError(message);
      setMembers([]);
      setSports([]);
    }
    try {
      const data = await enrollmentsService.getAll(buildApiFilters());
      setEnrollments(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al cargar las inscripciones';
      setListError(message);
      setEnrollments([]);
    } finally {
      setListLoading(false);
    }
  }, [buildApiFilters]);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmittingCreate(true);
    try {
      await enrollmentsService.create({
        member_id: formMemberId,
        sport_id: formSportId,
      });
      setSuccessMessage('Inscripción registrada correctamente.');
      setFormMemberId('');
      setFormSportId('');
      setIsCreateOpen(false);
      await loadEnrollments();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la inscripción. Intente nuevamente.';
      setFormError(message);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleToggleActive = async (row: EnrollmentDTO) => {
    const nextActive = !row.is_active;
    setUpdatingEnrollmentId(row.id);
    setListError(null);
    try {
      await enrollmentsService.update(row.id, { is_active: nextActive });
      setSuccessMessage(
        nextActive
          ? 'Inscripción activada.'
          : 'Inscripción desactivada.',
      );
      await loadEnrollments();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la inscripción.';
      setListError(message);
    } finally {
      setUpdatingEnrollmentId(null);
    }
  };

  const handleSoftDelete = async (row: EnrollmentDTO) => {
    const confirmed = window.confirm(
      '¿Seguro que querés dar de baja esta inscripción? Esta acción la quitará del listado operativo y no podrá activarse desde esta pantalla.',
    );
    if (!confirmed) {
      return;
    }
    setDeletingEnrollmentId(row.id);
    setListError(null);
    try {
      await enrollmentsService.softDelete(row.id);
      setSuccessMessage('Inscripción dada de baja correctamente.');
      await loadEnrollments();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo dar de baja la inscripción.';
      setListError(message);
    } finally {
      setDeletingEnrollmentId(null);
    }
  };

  const memberLabel = (memberId: string) =>
    members.find((m) => m.id === memberId)?.name ?? memberId;

  const sportLabel = (sportId: string) =>
    sports.find((s) => s.id === sportId)?.name ?? sportId;

  return (
    <>
      <DialogRoot open={isCreateOpen} onOpenChange={(e) => setIsCreateOpen(e.open)}>
        <DialogContent>
          <form onSubmit={(ev) => void handleCreateSubmit(ev)}>
            <DialogHeader>
              <DialogTitle>Nueva inscripción</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                {formError ? (
                  <Text color="red.600" fontWeight="medium">
                    {formError}
                  </Text>
                ) : null}
                <Field label="Socio" required>
                  <SelectRoot
                    collection={modalMemberCollection}
                    value={formMemberId ? [formMemberId] : []}
                    onValueChange={(ev) =>
                      setFormMemberId(ev.value[0] ?? '')
                    }
                  >
                    <SelectTrigger>
                      <SelectValueText placeholder="Seleccioná un socio" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalMemberCollection.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </Field>
                <Field label="Deporte" required>
                  <SelectRoot
                    collection={modalSportCollection}
                    value={formSportId ? [formSportId] : []}
                    onValueChange={(ev) =>
                      setFormSportId(ev.value[0] ?? '')
                    }
                  >
                    <SelectTrigger>
                      <SelectValueText placeholder="Seleccioná un deporte activo" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalSportCollection.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </Field>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogActionTrigger>
              <Button
                type="submit"
                colorPalette="blue"
                loading={isSubmittingCreate}
                disabled={!formMemberId || !formSportId}
              >
                Registrar inscripción
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
              Administración de Inscripciones
            </Heading>
            <Text color="fg.muted" fontSize="md">
              Alta y seguimiento de inscripciones al catálogo de deportes, con vigencia gestionada desde cada fila.
            </Text>
          </Stack>
          <HStack gap="3">
            <Button
              variant="outline"
              onClick={() => void handleRefresh()}
              loading={listLoading}
            >
              <LuRefreshCw /> Actualizar
            </Button>
            <Button colorPalette="blue" size="md" onClick={openCreateModal}>
              <LuPlus /> Nueva inscripción
            </Button>
          </HStack>
        </Flex>

        {successMessage ? (
          <Box
            bg="green.50"
            borderWidth="1px"
            borderColor="green.200"
            borderRadius="md"
            p="4"
          >
            <Text color="green.700" fontWeight="medium">
              {successMessage}
            </Text>
          </Box>
        ) : null}

        {catalogError ? (
          <Box
            p="4"
            bg="red.50"
            color="red.700"
            borderRadius="md"
            border="1px solid"
            borderColor="red.200"
          >
            <Text fontWeight="bold">Error al cargar listas auxiliares:</Text>
            <Text>{catalogError}</Text>
          </Box>
        ) : null}

        {listError ? (
          <Box
            p="4"
            bg="red.50"
            color="red.700"
            borderRadius="md"
            border="1px solid"
            borderColor="red.200"
          >
            <Text fontWeight="bold">Error:</Text>
            <Text>{listError}</Text>
          </Box>
        ) : null}

        <Stack gap="4" overflow="visible">
          <Heading size="md">Filtros</Heading>
          <Flex
            gap="4"
            wrap="wrap"
            align={{ base: 'stretch', md: 'flex-end' }}
            overflow="visible"
          >
            <Box minW={{ base: '100%', md: '220px' }} flex="1" position="relative">
              <Field label="Socio">
                <SelectRoot
                  collection={filterMemberCollection}
                  value={
                    filterMemberId
                      ? [filterMemberId]
                      : ['__all_members__']
                  }
                  onValueChange={(ev) => {
                    const v = ev.value[0] ?? '__all_members__';
                    setFilterMemberId(
                      v === '__all_members__' ? '' : v,
                    );
                  }}
                  positioning={{
                    sameWidth: true,
                    placement: 'bottom-start',
                    flip: false,
                    gutter: 4,
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Todos los socios" />
                  </SelectTrigger>
                  <SelectPositioner zIndex="dropdown">
                    <SelectContent maxH="260px">
                      {filterMemberCollection.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPositioner>
                </SelectRoot>
              </Field>
            </Box>
            <Box minW={{ base: '100%', md: '220px' }} flex="1" position="relative">
              <Field label="Deporte">
                <SelectRoot
                  collection={filterSportCollection}
                  value={
                    filterSportId ? [filterSportId] : ['__all_sports__']
                  }
                  onValueChange={(ev) => {
                    const v = ev.value[0] ?? '__all_sports__';
                    setFilterSportId(v === '__all_sports__' ? '' : v);
                  }}
                  positioning={{
                    sameWidth: true,
                    placement: 'bottom-start',
                    flip: false,
                    gutter: 4,
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Todos los deportes" />
                  </SelectTrigger>
                  <SelectPositioner zIndex="dropdown">
                    <SelectContent maxH="260px">
                      {filterSportCollection.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPositioner>
                </SelectRoot>
              </Field>
            </Box>
            <Box minW={{ base: '100%', md: '260px' }} flex="1" position="relative">
              <Field label="Vigencia">
                <SelectRoot
                  collection={vigenciaCollection}
                  value={[vigenciaFilter]}
                  onValueChange={(ev) => {
                    const v = ev.value[0];
                    setVigenciaFilter(
                      (v as VigenciaFilter) ?? 'all',
                    );
                  }}
                  positioning={{
                    sameWidth: true,
                    placement: 'bottom-start',
                    flip: false,
                    gutter: 4,
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Todas" />
                  </SelectTrigger>
                  <SelectPositioner zIndex="dropdown">
                    <SelectContent maxH="260px">
                      {vigenciaCollection.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPositioner>
                </SelectRoot>
              </Field>
            </Box>
          </Flex>
        </Stack>

        <Box
          bg="bg.panel"
          borderRadius="xl"
          boxShadow="sm"
          borderWidth="1px"
          overflow="hidden"
          minH="300px"
          position="relative"
        >
          {!catalogsLoaded || (listLoading && enrollments.length === 0) ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Spinner size="xl" color="blue.500" />
                <Text color="fg.muted">
                  {!catalogsLoaded
                    ? 'Cargando datos...'
                    : 'Cargando inscripciones...'}
                </Text>
              </Stack>
            </Center>
          ) : enrollments.length === 0 && !listLoading ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Text color="fg.muted">
                  No hay inscripciones que coincidan con los filtros.
                </Text>
                <Button variant="ghost" onClick={() => void loadEnrollments()}>
                  Reintentar
                </Button>
              </Stack>
            </Center>
          ) : (
            <Table.Root size="md" variant="line" interactive>
              <Table.Header>
                <Table.Row bg="bg.muted/50">
                  <Table.ColumnHeader py="4">Socio</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Deporte</Table.ColumnHeader>
                  <Table.ColumnHeader py="4">
                    Fecha de inscripción
                  </Table.ColumnHeader>
                  <Table.ColumnHeader py="4">Estado</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" textAlign="end">
                    Acciones
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {enrollments.map((row) => (
                  <Table.Row key={row.id} _hover={{ bg: 'bg.muted/30' }}>
                    <Table.Cell fontWeight="semibold" color="fg.emphasized">
                      {memberLabel(row.member_id)}
                    </Table.Cell>
                    <Table.Cell color="fg.muted">
                      {sportLabel(row.sport_id)}
                    </Table.Cell>
                    <Table.Cell color="fg.muted">
                      {formatEnrollmentDate(row.enrollment_date)}
                    </Table.Cell>
                    <Table.Cell>
                      <Box
                        display="inline-block"
                        px="2"
                        py="0.5"
                        borderRadius="md"
                        bg={row.is_active ? 'green.50' : 'gray.100'}
                        color={row.is_active ? 'green.700' : 'gray.700'}
                        fontSize="xs"
                        fontWeight="bold"
                      >
                        {row.is_active ? 'Vigente' : 'Histórica'}
                      </Box>
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <HStack gap="1" justify="flex-end">
                        {row.is_active ? (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            colorPalette="orange"
                            aria-label="Desactivar inscripción"
                            title="Desactivar inscripción"
                            loading={updatingEnrollmentId === row.id}
                            disabled={
                              deletingEnrollmentId !== null ||
                              (updatingEnrollmentId !== null &&
                                updatingEnrollmentId !== row.id)
                            }
                            onClick={() =>
                              void handleToggleActive(row)
                            }
                          >
                            <LuBan />
                          </IconButton>
                        ) : (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            colorPalette="green"
                            aria-label="Activar inscripción"
                            title="Activar inscripción"
                            loading={updatingEnrollmentId === row.id}
                            disabled={
                              deletingEnrollmentId !== null ||
                              (updatingEnrollmentId !== null &&
                                updatingEnrollmentId !== row.id)
                            }
                            onClick={() =>
                              void handleToggleActive(row)
                            }
                          >
                            <LuCheck />
                          </IconButton>
                        )}
                        <IconButton
                          variant="ghost"
                          size="sm"
                          colorPalette="red"
                          aria-label="Dar de baja inscripción"
                          title="Dar de baja inscripción"
                          loading={deletingEnrollmentId === row.id}
                          disabled={
                            updatingEnrollmentId !== null ||
                            (deletingEnrollmentId !== null &&
                              deletingEnrollmentId !== row.id)
                          }
                          onClick={() => void handleSoftDelete(row)}
                        >
                          <LuTrash2 />
                        </IconButton>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
          {listLoading && enrollments.length > 0 ? (
            <Center
              position="absolute"
              inset="0"
              bg="bg.panel/70"
              zIndex={1}
            >
              <Spinner size="xl" color="blue.500" />
            </Center>
          ) : null}
        </Box>
      </Stack>
    </>
  );
}
