import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DFU_TABLE, 
  GPM_TABLE, 
  DRAIN_PIPE_SIZING, 
  VENT_PIPE_SIZING,
  WATER_PIPE_SIZING,
  DRAINAGE_SLOPES,
  TRAP_REQUIREMENTS,
  FIXTURE_CLEARANCES
} from '@/data/plumbingCodes';

const PlumbingCodes = () => {
  const dfuEntries = Object.entries(DFU_TABLE);
  const gpmEntries = Object.entries(GPM_TABLE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Plumbing Codes Reference</h1>
        <p className="text-muted-foreground">IPC/UPC standards for pipe sizing and fixture requirements</p>
      </div>

      <Tabs defaultValue="dfu" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dfu">DFU Values</TabsTrigger>
          <TabsTrigger value="gpm">Water Demand</TabsTrigger>
          <TabsTrigger value="pipe-sizing">Pipe Sizing</TabsTrigger>
          <TabsTrigger value="slopes">Slopes</TabsTrigger>
          <TabsTrigger value="clearances">Clearances</TabsTrigger>
        </TabsList>

        {/* DFU Table */}
        <TabsContent value="dfu" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Drainage Fixture Units (DFU)</CardTitle>
              <CardDescription>
                DFU values determine drain pipe sizing based on total connected fixtures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fixture Type</TableHead>
                    <TableHead className="text-right">DFU Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dfuEntries.map(([fixture, dfu]) => (
                    <TableRow key={fixture}>
                      <TableCell className="capitalize">
                        {fixture.replace(/-/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{dfu}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GPM Table */}
        <TabsContent value="gpm" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Water Demand (GPM)</CardTitle>
              <CardDescription>
                Gallons per minute for cold and hot water supply sizing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fixture Type</TableHead>
                    <TableHead className="text-right">Cold (GPM)</TableHead>
                    <TableHead className="text-right">Hot (GPM)</TableHead>
                    <TableHead className="text-right">Total (GPM)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gpmEntries.map(([fixture, gpm]) => (
                    <TableRow key={fixture}>
                      <TableCell className="capitalize">
                        {fixture.replace(/-/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">{gpm.cold}</TableCell>
                      <TableCell className="text-right text-red-600">{gpm.hot}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{(gpm.cold + gpm.hot).toFixed(1)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipe Sizing */}
        <TabsContent value="pipe-sizing" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Drain Pipe Sizing</CardTitle>
                <CardDescription>Based on total DFU load</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Max DFU</TableHead>
                      <TableHead className="text-right">Pipe Size (in)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DRAIN_PIPE_SIZING.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell>≤ {entry.maxDFU}</TableCell>
                        <TableCell className="text-right font-mono">{entry.pipeSize}"</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vent Pipe Sizing</CardTitle>
                <CardDescription>Based on total DFU load</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Max DFU</TableHead>
                      <TableHead className="text-right">Pipe Size (in)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {VENT_PIPE_SIZING.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell>≤ {entry.maxDFU}</TableCell>
                        <TableCell className="text-right font-mono">{entry.pipeSize}"</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Water Pipe Sizing</CardTitle>
                <CardDescription>Based on total GPM demand</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Max GPM</TableHead>
                      <TableHead className="text-right">Pipe Size (in)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WATER_PIPE_SIZING.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell>≤ {entry.maxGPM}</TableCell>
                        <TableCell className="text-right font-mono">{entry.pipeSize}"</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Drainage Slopes */}
        <TabsContent value="slopes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Minimum Drainage Slopes</CardTitle>
              <CardDescription>
                Required slope per foot for horizontal drain pipes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pipe Size Range (inches)</TableHead>
                    <TableHead className="text-right">Min Slope (in/ft)</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DRAINAGE_SLOPES.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">
                        {entry.minPipeSize}" - {entry.maxPipeSize === Infinity ? '∞' : entry.maxPipeSize + '"'}
                      </TableCell>
                      <TableCell className="text-right">{entry.minSlope}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {entry.percentSlope.toFixed(2)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground mt-4">
                Note: Pipes 3" and larger require 1/8" per foot minimum slope. 
                Pipes smaller than 3" require 1/4" per foot minimum slope.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clearances */}
        <TabsContent value="clearances" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Trap Requirements</CardTitle>
                <CardDescription>Trap sizes and arm lengths by fixture</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fixtures</TableHead>
                      <TableHead className="text-right">Trap Size (in)</TableHead>
                      <TableHead className="text-right">Max Arm (ft)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TRAP_REQUIREMENTS.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize">
                          {entry.fixtureTypes.slice(0, 2).map(f => f.replace(/-/g, ' ')).join(', ')}
                          {entry.fixtureTypes.length > 2 && ` +${entry.fixtureTypes.length - 2}`}
                        </TableCell>
                        <TableCell className="text-right font-mono">{entry.minTrapSize}"</TableCell>
                        <TableCell className="text-right">{entry.maxTrapArmLength}'</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fixture Clearances</CardTitle>
                <CardDescription>Minimum required clearances (cm)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fixture</TableHead>
                      <TableHead className="text-right">Front</TableHead>
                      <TableHead className="text-right">Side</TableHead>
                      <TableHead className="text-right">Center-Center</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FIXTURE_CLEARANCES.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize">
                          {entry.fixtureType.replace(/-/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">{entry.frontClearance} cm</TableCell>
                        <TableCell className="text-right">{entry.sideClearance} cm</TableCell>
                        <TableCell className="text-right">{entry.centerToCenter} cm</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlumbingCodes;
