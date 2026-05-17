import {
  Table,
  Heading,
  Stack,
  Text,
  Box,
  Flex,
  Spinner,
  Center,
  Input,
  Button
} from "@chakra-ui/react";
import { useEffect, useState, useMemo } from "react";
import { paymentsService } from "../services/payments";
import { membersService } from "../services/members";
import type { PaymentDTO, MemberDTO } from "@alentapp/shared";
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  SelectLabel,
} from "../components/ui/select";
import { createListCollection } from "@chakra-ui/react";

const statuses = createListCollection({
  items: [
    { label: "Todos", value: "all" },
    { label: "Pendiente", value: "Pending" },
    { label: "Pagado", value: "Paid" },
    { label: "Cancelado", value: "Canceled" }
  ]
});

const months = createListCollection({
  items: [
    { label: "Todos", value: "all" },
    ...Array.from({ length: 12 }, (_, i) => ({ label: `Mes ${i + 1}`, value: (i + 1).toString() }))
  ]
});

export function PaymentsView() {
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");

  const fetchMembers = async () => {
    try {
      const data = await membersService.getAll();
      setMembers(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (filterStatus !== "all") filters.status = filterStatus;
      if (filterMonth !== "all") filters.month = parseInt(filterMonth, 10);
      if (filterYear) filters.year = parseInt(filterYear, 10);
      if (filterMemberId !== "all") filters.memberId = filterMemberId;

      const data = await paymentsService.getAll(filters);
      setPayments(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar los pagos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("¿Está seguro que desea cancelar este pago?")) return;
    try {
      await paymentsService.cancel(id);
      fetchPayments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [filterStatus, filterMonth, filterYear, filterMemberId]);

  const membersCollection = useMemo(() => {
    return createListCollection({
      items: [
        { label: "Todos los socios", value: "all" },
        ...members.map(m => ({ label: m.name, value: m.id }))
      ]
    });
  }, [members]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return { bg: 'green.50', color: 'green.700' };
      case 'Pending': return { bg: 'orange.50', color: 'orange.700' };
      case 'Canceled': return { bg: 'red.50', color: 'red.700' };
      default: return { bg: 'gray.50', color: 'gray.700' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Paid': return 'Pagado';
      case 'Pending': return 'Pendiente';
      case 'Canceled': return 'Cancelado';
      default: return status;
    }
  };

  const getMemberName = (id: string) => {
    const member = members.find(m => m.id === id);
    return member ? member.name : "Desconocido";
  };

  return (
    <Stack gap="8">
      <Flex justify="space-between" align="center">
        <Stack>
          <Heading size="lg">Gestión de Pagos</Heading>
          <Text color="fg.muted">Administra y consulta el historial de pagos de los socios.</Text>
        </Stack>
      </Flex>

      <Box bg="bg.panel" p="6" borderRadius="lg" boxShadow="sm" borderWidth="1px">
        <Heading size="sm" mb="4">Filtros</Heading>
        <Stack direction={{ base: "column", md: "row" }} gap="4">
          <Box flex="1">
            <SelectRoot collection={membersCollection} value={[filterMemberId]} onValueChange={(e) => setFilterMemberId(e.value[0])}>
              <SelectLabel mb="1">Socio</SelectLabel>
              <SelectTrigger>
                <SelectValueText placeholder="Todos" />
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
          <Box flex="1">
            <SelectRoot collection={statuses} value={[filterStatus]} onValueChange={(e) => setFilterStatus(e.value[0])}>
              <SelectLabel mb="1">Estado</SelectLabel>
              <SelectTrigger>
                <SelectValueText placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {statuses.items.map((status) => (
                  <SelectItem item={status} key={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </Box>
          <Box flex="1">
            <SelectRoot collection={months} value={[filterMonth]} onValueChange={(e) => setFilterMonth(e.value[0])}>
              <SelectLabel mb="1">Mes</SelectLabel>
              <SelectTrigger>
                <SelectValueText placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {months.items.map((m) => (
                  <SelectItem item={m} key={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </Box>
          <Box flex="1">
            <Text fontSize="sm" fontWeight="medium" mb="1">Año</Text>
            <Input
              placeholder="Ej. 2026"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            />
          </Box>
        </Stack>
      </Box>

      {error && (
        <Box bg="red.50" color="red.700" p="4" borderRadius="md">
          {error}
        </Box>
      )}

      <Box overflowX="auto" bg="bg.panel" borderRadius="lg" boxShadow="sm" borderWidth="1px">
        {isLoading ? (
          <Center p="10">
            <Spinner size="xl" />
          </Center>
        ) : payments.length === 0 ? (
          <Center p="10">
            <Text color="fg.muted">No se encontraron pagos con los filtros seleccionados.</Text>
          </Center>
        ) : (
          <Table.Root variant="line">
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader>Socio</Table.ColumnHeader>
                <Table.ColumnHeader>Período</Table.ColumnHeader>
                <Table.ColumnHeader>Monto</Table.ColumnHeader>
                <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
                <Table.ColumnHeader>Estado</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {payments.map((payment) => {
                const colors = getStatusColor(payment.status);
                return (
                  <Table.Row key={payment.id} _hover={{ bg: "bg.muted" }}>
                    <Table.Cell>
                      <Text fontWeight="medium">{getMemberName(payment.member_id)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {payment.month}/{payment.year}
                    </Table.Cell>
                    <Table.Cell>
                      ${payment.amount.toFixed(2)}
                    </Table.Cell>
                    <Table.Cell>
                      {new Date(payment.due_date).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <Box
                        display="inline-block"
                        px="2"
                        py="0.5"
                        borderRadius="md"
                        bg={colors.bg}
                        color={colors.color}
                        fontSize="xs"
                        fontWeight="bold"
                      >
                        {getStatusLabel(payment.status)}
                      </Box>
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                        <Button size="sm" colorPalette="red" variant="ghost" onClick={() => handleCancel(payment.id)}>
                          Cancelar
                        </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </Stack>
  );
}
