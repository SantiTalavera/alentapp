import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Badge,
  createListCollection,
} from '@chakra-ui/react';
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  SelectLabel,
} from '../components/ui/select';
import { LuPackage, LuRefreshCw, LuSearch, LuX, LuList } from 'react-icons/lu';
import type { EquipmentLoanDTO, LoanStatus, MemberDTO } from '@alentapp/shared';
import { Field } from '../components/ui/field';
import { membersService } from '../services/members';
import { loansService } from '../services/loans';

// Socios habilitados para recibir préstamos: Activo + no Cadete
function isEligible(m: MemberDTO): boolean {
  return m.status === 'Activo' && m.category !== 'Cadete';
}

const STATUS_COLOR: Record<LoanStatus, string> = {
  Prestado: 'blue',
  Devuelto: 'green',
  Dañado: 'red',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function EquipmentLoansView() {
  // ── Catálogo de socios (compartido entre formulario y filtro) ────
  const [allMembers, setAllMembers] = useState<MemberDTO[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Buscador de socio para el formulario ────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberDTO | null>(null);

  // ── Formulario de préstamo ──────────────────────────────────────
  const [itemName, setItemName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successLoan, setSuccessLoan] = useState<EquipmentLoanDTO | null>(null);

  // ── Listado de préstamos ────────────────────────────────────────
  const [loans, setLoans] = useState<EquipmentLoanDTO[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState<string | null>(null);
  // El filtro almacena el UUID internamente, igual que en PaymentsView
  const [filterMemberId, setFilterMemberId] = useState<string>('all');

  // ── Carga de socios ─────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await membersService.getAll();
      setAllMembers(data);
    } catch (err: unknown) {
      setMembersError(
        err instanceof Error ? err.message : 'Error al cargar los socios',
      );
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // ── Carga del listado de préstamos ──────────────────────────────
  const loadLoans = useCallback(async (memberId?: string) => {
    setLoansLoading(true);
    setLoansError(null);
    try {
      const data = await loansService.getAll(memberId);
      setLoans(data);
    } catch (err: unknown) {
      setLoansError(
        err instanceof Error ? err.message : 'Error al cargar los préstamos',
      );
    } finally {
      setLoansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Re-fetch de préstamos cada vez que cambia el filtro de socio (igual que en PaymentsView)
  useEffect(() => {
    const memberId = filterMemberId !== 'all' ? filterMemberId : undefined;
    void loadLoans(memberId);
  }, [filterMemberId, loadLoans]);

  // ── Socios elegibles para el formulario ─────────────────────────
  const eligibleMembers = useMemo(() => allMembers.filter(isEligible), [allMembers]);

  // ── Lista filtrada por búsqueda (selector del formulario) ────────
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleMembers;
    return eligibleMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.dni.toLowerCase().includes(q),
    );
  }, [eligibleMembers, searchQuery]);

  // ── Colección para el select de filtro (patrón Payments) ────────
  const membersCollection = useMemo(() => {
    return createListCollection({
      items: [
        { label: 'Todos los socios', value: 'all' },
        ...allMembers.map((m) => ({ label: m.name, value: m.id })),
      ],
    });
  }, [allMembers]);

  // ── Resolución UUID → nombre (igual que getMemberName en Payments) ─
  const getMemberName = (memberId: string): string => {
    const member = allMembers.find((m) => m.id === memberId);
    return member ? member.name : 'Socio desconocido';
  };

  // ── Handlers formulario ─────────────────────────────────────────
  const handleSelectMember = (member: MemberDTO) => {
    setSelectedMember(member);
    setSearchQuery('');
    setItemName('');
    setDueDate('');
    setFormError(null);
    setSuccessLoan(null);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setItemName('');
    setDueDate('');
    setFormError(null);
    setSuccessLoan(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setFormError(null);
    setSuccessLoan(null);
    setIsSubmitting(true);
    try {
      const loan = await loansService.create({
        item_name: itemName.trim(),
        member_id: selectedMember.id,
        ...(dueDate
          ? { due_date: new Date(dueDate + 'T12:00:00').toISOString() }
          : {}),
      });
      setSuccessLoan(loan);
      setItemName('');
      setDueDate('');
      // Recargar listado respetando el filtro activo
      const currentFilter = filterMemberId !== 'all' ? filterMemberId : undefined;
      void loadLoans(currentFilter);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el préstamo. Intente nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <Stack gap="8">
      {/* Encabezado */}
      <Flex justify="space-between" align="center" wrap="wrap" gap="4">
        <Stack gap="1">
          <Heading size="2xl" fontWeight="bold">
            Préstamos de Equipamiento
          </Heading>
          <Text color="fg.muted" fontSize="md">
            Registrá y consultá los préstamos de equipamiento del club.
          </Text>
        </Stack>
        <Button
          variant="outline"
          onClick={() => void loadMembers()}
          loading={membersLoading}
        >
          <LuRefreshCw /> Actualizar socios
        </Button>
      </Flex>

      {/* ── Sección: Registrar préstamo ── */}
      <Flex gap="8" align="flex-start" wrap={{ base: 'wrap', lg: 'nowrap' }}>
        {/* Panel izquierdo: buscador de socios */}
        <Box flex="1" minW={{ base: '100%', lg: '340px' }} maxW={{ lg: '380px' }}>
          <Stack gap="4">
            <Stack gap="1">
              <Text fontWeight="semibold" fontSize="sm" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                1 · Seleccioná el socio
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Solo se muestran socios <strong>Activos</strong> con categoría{' '}
                <strong>Pleno</strong> u <strong>Honorario</strong>.
              </Text>
            </Stack>

            {selectedMember ? (
              <Box
                bg="teal.50"
                borderRadius="xl"
                p="4"
                border="2px solid"
                borderColor="teal.300"
              >
                <Flex justify="space-between" align="flex-start">
                  <Stack gap="1">
                    <Text fontWeight="bold" color="teal.800">
                      {selectedMember.name}
                    </Text>
                    <Text fontSize="sm" color="teal.700">
                      DNI {selectedMember.dni}
                    </Text>
                    <HStack gap="2" mt="1">
                      <Box px="2" py="0.5" borderRadius="md" bg="teal.100" color="teal.800" fontSize="xs" fontWeight="bold">
                        {selectedMember.category}
                      </Box>
                      <Box px="2" py="0.5" borderRadius="md" bg="green.100" color="green.800" fontSize="xs" fontWeight="bold">
                        {selectedMember.status}
                      </Box>
                    </HStack>
                  </Stack>
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={handleClearMember} aria-label="Cambiar socio">
                    <LuX /> Cambiar
                  </Button>
                </Flex>
              </Box>
            ) : (
              <Stack gap="3">
                <Box position="relative">
                  <Input
                    id="member-search"
                    placeholder="Buscar por nombre o DNI…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    pl="10"
                  />
                  <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted" pointerEvents="none">
                    <LuSearch size={16} />
                  </Box>
                </Box>

                {membersError ? (
                  <Box p="3" bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                    <Text color="red.700" fontSize="sm">{membersError}</Text>
                  </Box>
                ) : membersLoading ? (
                  <Center py="6">
                    <Spinner size="md" color="teal.500" />
                  </Center>
                ) : eligibleMembers.length === 0 ? (
                  <Box p="4" bg="orange.50" borderRadius="lg" border="1px solid" borderColor="orange.200">
                    <Text color="orange.800" fontSize="sm" fontWeight="medium">
                      No hay socios habilitados para recibir préstamos en este momento.
                    </Text>
                  </Box>
                ) : filteredMembers.length === 0 ? (
                  <Box p="4" bg="bg.muted" borderRadius="lg">
                    <Text color="fg.muted" fontSize="sm">
                      No se encontraron socios con «{searchQuery}».
                    </Text>
                  </Box>
                ) : (
                  <Stack gap="2" maxH="380px" overflowY="auto" pr="1">
                    {filteredMembers.map((m) => (
                      <Box
                        key={m.id}
                        p="3"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        bg="bg.panel"
                        cursor="pointer"
                        _hover={{ borderColor: 'teal.400', bg: 'teal.50' }}
                        transition="all 0.15s"
                        onClick={() => handleSelectMember(m)}
                      >
                        <Flex justify="space-between" align="center">
                          <Stack gap="0.5">
                            <Text fontWeight="semibold" fontSize="sm">{m.name}</Text>
                            <Text fontSize="xs" color="fg.muted">DNI {m.dni}</Text>
                          </Stack>
                          <Box px="2" py="0.5" borderRadius="md" bg="blue.50" color="blue.700" fontSize="xs" fontWeight="bold">
                            {m.category}
                          </Box>
                        </Flex>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Panel derecho: formulario */}
        <Box flex="1" minW={{ base: '100%', lg: '320px' }}>
          <Stack gap="4">
            <Stack gap="1">
              <Text fontWeight="semibold" fontSize="sm" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                2 · Detalle del préstamo
              </Text>
            </Stack>

            <Box
              bg="bg.panel"
              borderRadius="xl"
              boxShadow="sm"
              borderWidth="1px"
              p="6"
              opacity={selectedMember ? 1 : 0.4}
              pointerEvents={selectedMember ? 'auto' : 'none'}
              transition="opacity 0.2s"
            >
              <form onSubmit={(ev) => void handleSubmit(ev)}>
                <Stack gap="5">
                  {!selectedMember && (
                    <Box p="4" bg="bg.muted" borderRadius="md">
                      <HStack gap="2" color="fg.muted">
                        <LuPackage size={16} />
                        <Text fontSize="sm">Seleccioná un socio para habilitar el formulario.</Text>
                      </HStack>
                    </Box>
                  )}

                  {formError && (
                    <Box p="3" bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                      <Text color="red.700" fontWeight="medium" fontSize="sm">{formError}</Text>
                    </Box>
                  )}

                  {successLoan && (
                    <Box p="4" bg="green.50" borderRadius="md" border="1px solid" borderColor="green.200">
                      <Text color="green.700" fontWeight="semibold">✅ Préstamo registrado correctamente.</Text>
                      <Text color="green.600" fontSize="sm" mt="1">
                        Ítem: {successLoan.item_name} · Estado: {successLoan.status}
                        {successLoan.due_date
                          ? ` · Devolver antes de: ${new Date(successLoan.due_date).toLocaleDateString('es-AR')}`
                          : ''}
                      </Text>
                    </Box>
                  )}

                  <Field label="Nombre del ítem" required>
                    <Input
                      id="loan-item-name"
                      placeholder="Ej: Raqueta de tenis N°3"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      disabled={isSubmitting || !selectedMember}
                      required
                    />
                  </Field>

                  <Field label="Fecha de devolución (opcional)">
                    <Input
                      id="loan-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={isSubmitting || !selectedMember}
                    />
                  </Field>

                  <Button
                    type="submit"
                    colorPalette="teal"
                    loading={isSubmitting}
                    disabled={!selectedMember || !itemName.trim()}
                    w="full"
                  >
                    <LuPackage /> Registrar préstamo
                  </Button>
                </Stack>
              </form>
            </Box>
          </Stack>
        </Box>
      </Flex>

      {/* ── Sección: Listado de préstamos ── */}
      <Box>
        <Stack gap="4">
          {/* Encabezado + filtro */}
          <Flex justify="space-between" align="flex-end" wrap="wrap" gap="3">
            <HStack gap="2">
              <LuList size={20} />
              <Text fontWeight="semibold" fontSize="lg">Listado de Préstamos</Text>
            </HStack>

            {/* Filtro por socio — patrón idéntico a PaymentsView */}
            <Box minW="240px">
              <SelectRoot
                collection={membersCollection}
                value={[filterMemberId]}
                onValueChange={(e) => setFilterMemberId(e.value[0])}
              >
                <SelectLabel mb="1" fontSize="sm">Filtrar por socio</SelectLabel>
                <SelectTrigger>
                  <SelectValueText placeholder="Todos los socios" />
                </SelectTrigger>
                <SelectContent>
                  {membersCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </Box>
          </Flex>

          {/* Estado: error / cargando / vacío / tabla */}
          {loansError ? (
            <Box p="4" bg="red.50" borderRadius="lg" border="1px solid" borderColor="red.200">
              <Text color="red.700" fontSize="sm">{loansError}</Text>
            </Box>
          ) : loansLoading ? (
            <Center py="10">
              <Spinner size="lg" color="teal.500" />
            </Center>
          ) : loans.length === 0 ? (
            <Box p="8" bg="bg.muted" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" textAlign="center">
              <Text color="fg.muted" fontSize="sm">
                No se encontraron préstamos{filterMemberId !== 'all' ? ' para el socio seleccionado' : ''}.
              </Text>
            </Box>
          ) : (
            <Box borderRadius="xl" overflow="hidden" borderWidth="1px" borderColor="border.subtle" bg="bg.panel" boxShadow="sm">
              <Table.Root variant="line" size="sm">
                <Table.Header>
                  <Table.Row bg="bg.subtle">
                    <Table.ColumnHeader fontWeight="semibold" fontSize="xs" textTransform="uppercase" letterSpacing="wide" py="3" px="4">
                      Socio
                    </Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="semibold" fontSize="xs" textTransform="uppercase" letterSpacing="wide" py="3" px="4">
                      Ítem
                    </Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="semibold" fontSize="xs" textTransform="uppercase" letterSpacing="wide" py="3" px="4">
                      Estado
                    </Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="semibold" fontSize="xs" textTransform="uppercase" letterSpacing="wide" py="3" px="4">
                      Fecha préstamo
                    </Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="semibold" fontSize="xs" textTransform="uppercase" letterSpacing="wide" py="3" px="4">
                      Devolución
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {loans.map((loan) => (
                    <Table.Row key={loan.id} _hover={{ bg: 'bg.muted' }} transition="background 0.1s">
                      {/* Nombre del socio resuelto desde UUID — el usuario nunca ve el UUID */}
                      <Table.Cell py="3" px="4" fontWeight="medium" fontSize="sm">
                        {getMemberName(loan.member_id)}
                      </Table.Cell>
                      <Table.Cell py="3" px="4" fontSize="sm">
                        {loan.item_name}
                      </Table.Cell>
                      <Table.Cell py="3" px="4">
                        <Badge
                          colorPalette={STATUS_COLOR[loan.status]}
                          variant="subtle"
                          fontSize="xs"
                          px="2"
                          py="0.5"
                          borderRadius="md"
                        >
                          {loan.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell py="3" px="4" fontSize="sm" color="fg.muted">
                        {formatDate(loan.loan_date)}
                      </Table.Cell>
                      <Table.Cell py="3" px="4" fontSize="sm" color="fg.muted">
                        {formatDate(loan.due_date)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
