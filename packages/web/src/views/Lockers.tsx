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
  Input,
  SelectPositioner,
  Spinner,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { LuPlus, LuRefreshCw, LuTrash2, LuPencil } from 'react-icons/lu';
import type { LockerDTO, MemberDTO, CreateLockerRequest, UpdateLockerRequest } from '@alentapp/shared';
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
import { lockersService } from '../services/lockers';
import { membersService } from '../services/members';

const statusFilterCollection = createListCollection({
  items: [
    { label: 'Todos los estados', value: 'all' },
    { label: 'Disponible', value: 'Available' },
    { label: 'Ocupado', value: 'Occupied' },
    { label: 'Mantenimiento', value: 'Maintenance' },
  ],
});

const statusEditCollection = createListCollection({
  items: [
    { label: 'Disponible', value: 'Available' },
    { label: 'Ocupado', value: 'Occupied' },
    { label: 'Mantenimiento', value: 'Maintenance' },
  ],
});

export function LockersView() {
  const [lockers, setLockers] = useState<LockerDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [catalogsLoaded, setCatalogsLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Éxito / Feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modales y formularios
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formNumber, setFormNumber] = useState(0);
  const [formLocation, setFormLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [editingLocker, setEditingLocker] = useState<LockerDTO | null>(null);
  const [editNumber, setEditNumber] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editStatus, setEditStatus] = useState<LockerDTO['status']>('Available');
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Colecciones dinámicas de filtros y modales
  const locationsCollection = useMemo(() => {
    const locations = Array.from(new Set(lockers.map((l) => l.location))).sort();
    return createListCollection({
      items: [
        { label: 'Todas las ubicaciones', value: 'all' },
        ...locations.map((loc) => ({ label: loc, value: loc })),
      ],
    });
  }, [lockers]);

  const modalMemberCollection = useMemo(() => {
    return createListCollection({
      items: [
        { label: 'Sin socio asignado', value: '__none__' },
        ...members.map((m) => ({
          label: `${m.name} ${m.lastName} — DNI ${m.dni}`,
          value: m.id,
        })),
      ],
    });
  }, [members]);

  const loadCatalogs = useCallback(async () => {
    setCatalogError(null);
    try {
      const membersData = await membersService.getAll();
      setMembers(membersData);
      setCatalogsLoaded(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar los socios';
      setCatalogError(message);
      setMembers([]);
      setCatalogsLoaded(true);
    }
  }, []);

  const loadLockers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await lockersService.getAll();
      setLockers(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar los casilleros';
      setListError(message);
      setLockers([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogs();
    void loadLockers();
  }, [loadCatalogs, loadLockers]);

  const openCreateModal = () => {
    setFormNumber(0);
    setFormLocation('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (locker: LockerDTO) => {
    setEditingLocker(locker);
    setEditNumber(locker.number);
    setEditLocation(locker.location);
    setEditStatus(locker.status);
    setEditMemberId(locker.member_id || '__none__');
    setEditError(null);
  };

  const handleRefresh = useCallback(async () => {
    setSuccessMessage(null);
    setListLoading(true);
    setCatalogError(null);
    setListError(null);
    try {
      const membersData = await membersService.getAll();
      setMembers(membersData);
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : 'Error al cargar los socios');
    }
    try {
      const data = await lockersService.getAll();
      setLockers(data);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Error al cargar los casilleros');
    } finally {
      setListLoading(false);
    }
  }, []);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmittingCreate(true);
    try {
      await lockersService.create({
        number: Number(formNumber),
        location: formLocation,
      });
      setSuccessMessage(`Casillero #${formNumber} registrado correctamente.`);
      setIsCreateOpen(false);
      await loadLockers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el casillero.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLocker) return;
    setEditError(null);
    setIsSubmittingEdit(true);
    try {
      const payload: UpdateLockerRequest = {
        number: Number(editNumber),
        location: editLocation,
        status: editStatus,
        member_id: editMemberId === '__none__' ? null : editMemberId,
      };
      await lockersService.update(editingLocker.id, payload);
      setSuccessMessage(`Casillero #${editNumber} modificado correctamente.`);
      setEditingLocker(null);
      await loadLockers();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'No se pudo actualizar el casillero.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async (locker: LockerDTO) => {
    const confirmed = window.confirm(
      `¿Seguro que querés dar de baja el casillero #${locker.number}? Esta acción lo retirará permanentemente de la gestión operativa.`
    );
    if (!confirmed) return;
    setListLoading(true);
    setListError(null);
    try {
      await lockersService.delete(locker.id);
      setSuccessMessage(`Casillero #${locker.number} dado de baja correctamente.`);
      await loadLockers();
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'No se pudo dar de baja el casillero.');
    } finally {
      setListLoading(false);
    }
  };

  // Filtrado del cliente
  const filteredLockers = useMemo(() => {
    return lockers.filter((l) => {
      const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
      const matchesLocation = filterLocation === 'all' || l.location === filterLocation;
      return matchesStatus && matchesLocation;
    });
  }, [lockers, filterStatus, filterLocation]);

  const memberLabel = (memberId: string | null) => {
    if (!memberId) return 'Sin socio asignado';
    const m = members.find((x) => x.id === memberId);
    return m ? `${m.name} ${m.lastName}` : memberId;
  };

  return (
    <>
      {/* Modal: Crear casillero */}
      <DialogRoot open={isCreateOpen} onOpenChange={(e) => setIsCreateOpen(e.open)}>
        <DialogContent bg="gray.900" border="1px solid" borderColor="gray.850">
          <form onSubmit={(ev) => void handleCreateSubmit(ev)}>
            <DialogHeader>
              <DialogTitle color="white">Registrar Casillero</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Stack gap="4">
                {formError ? (
                  <Text color="red.400" fontWeight="medium" fontSize="sm">
                    {formError}
                  </Text>
                ) : null}
                <Field label="Número de casillero" required>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    bg="gray.950"
                    borderColor="gray.800"
                    _focus={{ borderColor: "blue.500" }}
                    value={formNumber || ''}
                    onChange={(e) => setFormNumber(parseInt(e.target.value, 10) || 0)}
                    placeholder="Ej: 101"
                  />
                </Field>
                <Field label="Ubicación" required>
                  <Input
                    bg="gray.950"
                    borderColor="gray.800"
                    _focus={{ borderColor: "blue.500" }}
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ej: Vestuario de hombres"
                  />
                </Field>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline" colorPalette="gray">Cancelar</Button>
              </DialogActionTrigger>
              <Button
                type="submit"
                colorPalette="blue"
                loading={isSubmittingCreate}
                disabled={!formNumber || !formLocation}
              >
                Crear casillero
              </Button>
            </DialogFooter>
            <DialogCloseTrigger />
          </form>
        </DialogContent>
      </DialogRoot>

      {/* Modal: Modificar casillero */}
      <DialogRoot open={!!editingLocker} onOpenChange={(e) => { if (!e.open) setEditingLocker(null); }}>
        <DialogContent bg="gray.900" border="1px solid" borderColor="gray.850">
          {editingLocker && (
            <form onSubmit={(ev) => void handleEditSubmit(ev)}>
              <DialogHeader>
                <DialogTitle color="white">Modificar Casillero #{editingLocker.number}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Stack gap="4">
                  {editError ? (
                    <Text color="red.400" fontWeight="medium" fontSize="sm">
                      {editError}
                    </Text>
                  ) : null}
                  <Field label="Número" required>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      bg="gray.950"
                      borderColor="gray.800"
                      _focus={{ borderColor: "blue.500" }}
                      value={editNumber || ''}
                      onChange={(e) => setEditNumber(parseInt(e.target.value, 10) || 0)}
                    />
                  </Field>
                  <Field label="Ubicación" required>
                    <Input
                      bg="gray.950"
                      borderColor="gray.800"
                      _focus={{ borderColor: "blue.500" }}
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </Field>
                  <Field label="Estado">
                    <SelectRoot
                      collection={statusEditCollection}
                      value={[editStatus]}
                      onValueChange={(ev) => setEditStatus(ev.value[0] as LockerDTO['status'])}
                      positioning={{ sameWidth: true, placement: 'bottom-start', flip: false, gutter: 4 }}
                    >
                      <SelectTrigger>
                        <SelectValueText placeholder="Seleccione un estado" />
                      </SelectTrigger>
                      <SelectPositioner zIndex="dropdown">
                        <SelectContent bg="gray.900" maxH="200px">
                          {statusEditCollection.items.map((item) => (
                            <SelectItem item={item} key={item.value} _hover={{ bg: "gray.800" }}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectPositioner>
                    </SelectRoot>
                  </Field>
                  <Field label="Socio Asignado">
                    <SelectRoot
                      collection={modalMemberCollection}
                      value={editMemberId ? [editMemberId] : ['__none__']}
                      onValueChange={(ev) => setEditMemberId(ev.value[0] ?? '__none__')}
                      positioning={{ sameWidth: true, placement: 'bottom-start', flip: false, gutter: 4 }}
                    >
                      <SelectTrigger>
                        <SelectValueText placeholder="Sin socio asignado" />
                      </SelectTrigger>
                      <SelectPositioner zIndex="dropdown">
                        <SelectContent bg="gray.900" maxH="200px">
                          {modalMemberCollection.items.map((item) => (
                            <SelectItem item={item} key={item.value} _hover={{ bg: "gray.800" }}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectPositioner>
                    </SelectRoot>
                  </Field>
                </Stack>
              </DialogBody>
              <DialogFooter>
                <DialogActionTrigger asChild>
                  <Button variant="outline" colorPalette="gray">Cancelar</Button>
                </DialogActionTrigger>
                <Button
                  type="submit"
                  colorPalette="blue"
                  loading={isSubmittingEdit}
                  disabled={!editNumber || !editLocation}
                >
                  Guardar cambios
                </Button>
              </DialogFooter>
              <DialogCloseTrigger />
            </form>
          )}
        </DialogContent>
      </DialogRoot>

      {/* Estructura Principal */}
      <Stack gap="8">
        <Flex justify="space-between" align="center" wrap="wrap" gap="4">
          <Stack gap="1">
            <Heading size="2xl" fontWeight="bold" color="white">
              Administración de Casilleros
            </Heading>
            <Text color="fg.muted" fontSize="md">
              Alta y seguimiento del inventario de casilleros del club, con vigencia y estado gestionados desde cada fila.
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
              <LuPlus /> Nuevo casillero
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
            <Text fontWeight="bold">Error al cargar socios:</Text>
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
          <Heading size="md" color="white">Filtros</Heading>
          <Flex
            gap="4"
            wrap="wrap"
            align={{ base: 'stretch', md: 'flex-end' }}
            overflow="visible"
          >
            <Box minW={{ base: '100%', md: '220px' }} flex="1" position="relative">
              <Field label="Estado">
                <SelectRoot
                  collection={statusFilterCollection}
                  value={[filterStatus]}
                  onValueChange={(ev) => setFilterStatus(ev.value[0] ?? 'all')}
                  positioning={{
                    sameWidth: true,
                    placement: 'bottom-start',
                    flip: false,
                    gutter: 4,
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectPositioner zIndex="dropdown">
                    <SelectContent maxH="260px">
                      {statusFilterCollection.items.map((item) => (
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
              <Field label="Ubicación">
                <SelectRoot
                  collection={locationsCollection}
                  value={[filterLocation]}
                  onValueChange={(ev) => setFilterLocation(ev.value[0] ?? 'all')}
                  positioning={{
                    sameWidth: true,
                    placement: 'bottom-start',
                    flip: false,
                    gutter: 4,
                  }}
                >
                  <SelectTrigger>
                    <SelectValueText placeholder="Todas las ubicaciones" />
                  </SelectTrigger>
                  <SelectPositioner zIndex="dropdown">
                    <SelectContent maxH="260px">
                      {locationsCollection.items.map((item) => (
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
          {!catalogsLoaded || (listLoading && lockers.length === 0) ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Spinner size="xl" color="blue.500" />
                <Text color="fg.muted">
                  Cargando casilleros...
                </Text>
              </Stack>
            </Center>
          ) : filteredLockers.length === 0 && !listLoading ? (
            <Center h="300px">
              <Stack align="center" gap="4">
                <Text color="fg.muted">
                  No hay casilleros que coincidan con los filtros.
                </Text>
                <Button variant="ghost" onClick={() => void loadLockers()}>
                  Reintentar
                </Button>
              </Stack>
            </Center>
          ) : (
            <Table.Root size="md" variant="line" interactive>
              <Table.Header>
                <Table.Row bg="bg.muted/50">
                  <Table.ColumnHeader py="4" color="white">Número</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" color="white">Ubicación</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" color="white">Estado</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" color="white">Socio</Table.ColumnHeader>
                  <Table.ColumnHeader py="4" textAlign="end" color="white">
                    Acciones
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredLockers.map((row) => (
                  <Table.Row key={row.id} _hover={{ bg: 'bg.muted/30' }}>
                    <Table.Cell fontWeight="semibold" color="fg.emphasized">
                      #{row.number}
                    </Table.Cell>
                    <Table.Cell color="fg.muted">
                      {row.location}
                    </Table.Cell>
                    <Table.Cell>
                      <Box
                        display="inline-block"
                        px="2"
                        py="0.5"
                        borderRadius="md"
                        bg={
                          row.status === 'Available'
                            ? 'green.900/40'
                            : row.status === 'Occupied'
                            ? 'blue.900/40'
                            : 'orange.900/40'
                        }
                        color={
                          row.status === 'Available'
                            ? 'green.300'
                            : row.status === 'Occupied'
                            ? 'blue.300'
                            : 'orange.300'
                        }
                        fontSize="xs"
                        fontWeight="bold"
                      >
                        {row.status === 'Available'
                          ? 'Disponible'
                          : row.status === 'Occupied'
                          ? 'Ocupado'
                          : 'Mantenimiento'}
                      </Box>
                    </Table.Cell>
                    <Table.Cell color={row.member_id ? "blue.300" : "fg.muted"}>
                      {memberLabel(row.member_id)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <HStack gap="1" justify="flex-end">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          colorPalette="blue"
                          aria-label="Modificar casillero"
                          title="Modificar casillero"
                          onClick={() => openEditModal(row)}
                        >
                          <LuPencil />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          colorPalette="red"
                          aria-label="Dar de baja casillero"
                          title="Dar de baja casillero"
                          onClick={() => void handleDelete(row)}
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
          {listLoading && lockers.length > 0 ? (
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
