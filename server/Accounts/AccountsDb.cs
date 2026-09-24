using Microsoft.EntityFrameworkCore;

namespace Accounts;

/// <summary>
/// The tables, and the mapping that names them. `dotnet ef migrations add`
/// (`yarn db:generate`) diffs this model against the last snapshot in
/// Migrations/ and writes the SQL; applying it is Program.cs's job at startup,
/// so a fresh database is brought up to date by the process that needs it and
/// one already at the current version is left alone. EF records what it has
/// applied in its own <c>__EFMigrationsHistory</c> table, so a restart is a no-op.
///
/// Lower-case, singular column names and a lower-case table, declared once by
/// looping rather than eight times by hand: the SQL is what the Node version's
/// migration created, and the point of a migration is that the table does not
/// change when the code that reads it does.
/// </summary>
public sealed class AccountsDb(DbContextOptions<AccountsDb> options) : DbContext(options)
{
    public DbSet<AccountRow> Accounts => Set<AccountRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var accounts = modelBuilder.Entity<AccountRow>().ToTable("accounts");
        accounts.HasKey(row => row.Session);
        // Said outright, although the property is a non-nullable string like
        // every other: EF Core first takes a property called `Id` for the key by
        // convention, and once the key is moved to `Session` it leaves that
        // column nullable, where the same declaration on `Nom` is NOT NULL.
        accounts.Property(row => row.Id).IsRequired();
        foreach (var property in accounts.Metadata.GetProperties())
        {
            property.SetColumnName(property.Name.ToLowerInvariant());
        }
    }

    /// <summary>
    /// Where the database is. DATABASE_URL is documented in .env.example; locally
    /// it names the Postgres from compose.yaml, in CI the job's `postgres` service.
    /// Read lazily, when the context is first built, so `dotnet ef migrations add`
    /// - which builds the model and never connects - still needs it set: a
    /// placeholder would hide a missing variable from the process that does.
    /// </summary>
    public static string ConnectionString() =>
        Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? throw new InvalidOperationException("DATABASE_URL is not set; see .env.example");
}
